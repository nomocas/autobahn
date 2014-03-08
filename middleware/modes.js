/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 */
var deep = require("deepjs");

exports.middleware = function(getModes){

	return function (req, response, next)
	{
		deep.context.session = req.session;
		deep.when(getModes(req.session))
		.done(function (modes) {
			 //console.log("middleware roles : roles getted : ", roles, req.session)
			deep.modes(modes)
			.done(function(){
				//console.log("roles middleware : execute next", this._context.modes)
				next();
			})
			.fail(function (e) {
				console.log("set modes fail : ", e);
				deep.utils.dumpError(e);
			})
		})
		.fail(function(e){
			// console.log("autobahn roles middleware error : ", e.toString());
			response.writeHead(e.status || 400, {'Content-Type': 'text/html'});
			response.end("error : "+JSON.stringify(e));
		});
	};
};