/**
 * @author Gilles Coomans <gilles.coomans@gmail.com>
 *
 * Contextualised protocols middleware.
 * Define current contextualised protocols.
 */
var deep = require("deepjs");
exports.middleware = function(initialiser){
	return function (req, response, next)
	{
		// console.log("protocols middleware")
		if(typeof initialiser === 'object')
			deep.Promise.context.protocols = initialiser;
		else if(typeof initialiser === 'function')
			deep.Promise.context.protocols = initialiser();
		deep.when(deep.Promise.context.protocols)
		.done(function(context){
			// console.log("context middleware initialised")
			next();
		})
		.fail(function(e){
			// console.log("context middleware initialiser error : ", e.toString());
			response.writeHead(e.status || 400, {'Content-Type': 'text/html'});
			response.end("local protocols initialisation error : "+JSON.stringify(e));
		});
	};
};
