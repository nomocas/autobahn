//promised-http client

if(typeof define !== 'function')
	var define = require('amdefine')(module);

define(function (require)
{
	var http = require('http');
	/**
	* @param options see http://nodejs.org/api/http.html#http_http_request_options_callback
	* @param datas optional body to send with request
	*/
	var requester = function(options, datas){

		var def = deep.Deferred();
		var response = {
			status:null,
			body:null,
			headers:null
		};

		var maxRedirections = options.maxRedirections || 10;
		try{
		var req = http.request(options, function(res) {
			response.status = res.statusCode;
			response.headers = res.headers;
			response.body = '';
			res.setEncoding('utf8');
			res.on('data', function (chunk)
			{
				response.body += chunk.toString();
			});
			res.on("end", function ()
			{
				if(response.status > 299 && response.status < 400) // receive redirection
				{
					if(maxRedirections == 0)
						throw new Error("promised-node-http : maxRedirections reached : aborting request ! : "+JSON.stringify(options));
					maxRedirections--;
					options.maxRedirections = maxRedirections;
					requester(options, datas).done(function (res)
					{
						def.resolve(res);
					});
				}
				else
				{
					try
					{
						response.body = deep.utils.parseBody(response.body, response.headers);
				  	  	def.resolve(response);
					}
					catch(e)
					{
						def.reject(e);
					}
				}
			});
			res.on('error', function(e)
			{
				console.log("promised-node-http : error : ", error);
				def.reject(e);
			});
		});

		req.on('error', function(e) {
			def.reject(e);
		});

	   	if(datas)
			req.write(JSON.stringify(datas));
		req.end();

		}
		catch(e){
			console.log("catche error in promised-node-http :  error : ";, e);
			if(!def.rejected)
				def.reject(e);
		}
		return deep.promise(def);
	}
	return requester;
});