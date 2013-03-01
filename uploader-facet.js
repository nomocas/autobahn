#!/usr/bin/env node
/*

Gestion des roles : 

    roles = {
        admin:{
            // full rights
        },
        user:{
            backgrounds:["#../admin"]
            // restricted user rights : sould remove or restrict admin roles
        },
        public:{
            backgrounds:["#../user"]
            // restricted public rights : sould remove or restrict user roles

        },
        traducteur:{
            
        }
    }

    var role = {
        statics:[],
        facettes:{},
        routes:{}
    }
    var facette = {
        store:{},
        allowedMethods:["POST"]    
        post:autobahn.facets
        .post({ schema:{} })
        .owner()
        .around(function (old) {
          return function (argument) {
              
          }
        }),
        put:autobahn
        .put({ owner:true, schema:{} })
        .owner(),
        
    }

    var 

*/

    'use strict';

if(typeof define !== 'function'){
    var define = require('amdefine')(module);
}

define(function (require){

    var deep = require("deep/deep");
    var path = require('path'),
        fs = require('fs'),
        // Since Node 0.8, .existsSync() moved from path to fs:
        _existsSync = fs.existsSync || path.existsSync,
        formidable = require('formidable'),
      //  nodeStatic = require('node-static'),
        imageMagick = require('imagemagick'),
        utf8encode = function (str) {
            return unescape(encodeURIComponent(str));
        },
        nameCountRegexp = /(?:(?:\(([\d]+)\))?(\.[^.]+))?$/,
        nameCountFunc = function (s, index, ext) {
            return '(' + ((parseInt(index, 10) || 0) + 1) + ')' + (ext || '');
        },
        FileInfo = function (file, options, req) {
            this.file = file;
            this.name = file.name;
            this.size = file.size;
            this.type = file.type;
            this.options = options;
            this.delete_type = 'DELETE';
            this.req = req;
        };
        var Facet = require("autobahn/facet-controller");
        var utils = require("autobahn/utils");

/*
    fileServer.respond = function (pathname, status, _headers, files, stat, req, res, finish) 
    {
        if (!this.options.safeFileTypes.test(files[0])) 
        {
            // Force a download dialog for unsafe file extensions:
            deep.utils.up({
                'Content-Disposition': 'attachment; filename="' + utf8encode(path.basename(files[0])) + '"'
            }, req.autobahn.response.headers)
        } 
        else 
        {
            // Prevent Internet Explorer from MIME-sniffing the content-type:
            deep.utils.up({
                'X-Content-Type-Options': 'nosniff'
            }, req.autobahn.response.headers)
        }
        nodeStatic.Server.prototype.respond.call(this, pathname, status, _headers, files, stat, req, res, finish);
    };*/
    FileInfo.prototype.validate = function () 
    {
        if (this.options.minFileSize && this.options.minFileSize > this.size) 
            this.error = 'File is too small';
        else if (this.options.maxFileSize && this.options.maxFileSize < this.size) 
            this.error = 'File is too big';
        else if (!this.options.acceptFileTypes.test(this.name))
            this.error = 'Filetype not allowed';
        return !this.error;
    };
    FileInfo.prototype.safeName = function (uploadDir) 
    {
        // Prevent directory traversal and creating hidden system files:
        this.name = path.basename(this.name).replace(/^\.+/, '');
        // Prevent overwriting existing files:
        while (_existsSync(uploadDir + '/' + this.name)) 
            this.name = this.name.replace(nameCountRegexp, nameCountFunc);
    };
    FileInfo.prototype.initUrls = function (options) {
        if (!this.error) {
            var that = this,
                baseUrl = (options.ssl ? 'https:' : 'http:') + '//' + this.req.headers.host + options.uploadUrl;
            this.url = this.delete_url = baseUrl + encodeURIComponent(this.name);
            Object.keys(options.imageVersions).forEach(function (version) 
            {
                if (_existsSync( options.uploadDir + '/' + version + '/' + that.name )) 
                    that[version + '_url'] = baseUrl + version + '/' + encodeURIComponent(that.name);
            });
        }
    };
    FileInfo.prototype.destroy = function(){
        fs.unlink(this.file.path);
    }
    FileInfo.prototype.moveAndResize = function (options) 
    {
        var self = this;
        console.log("FileInfo.prototype.moveAndResize : ", options)
        var def = deep.Deferred();
        this.safeName(options.uploadDir);
        fs.renameSync(this.file.path, options.uploadDir + '/' + this.name);
        var count = 0;
        var res = {
            fileInfo:this,
            main:options.uploadDir + '/' + this.name
         }
         var finished = function (err, stdoutContent, stderrContent) {
            if(err)
                console.log("WARNING : error while resizing : ", err, stdoutContent,stderrContent )
            count--;
            if(count <= 0)
            {
                self.initUrls(options);
                def.resolve(res);
            }
         }
        if (options.imageTypes.test(this.name)) 
        {
            var vers = Object.keys(options.imageVersions);
            count = vers.length;
            if(count > 0)
                vers.forEach(function (version) 
                {   
                    console.log("do resize : ", version)
                    var opts = options.imageVersions[version];
                    imageMagick.resize({
                        width: opts.width,
                        height: opts.height,
                        srcPath: options.uploadDir + '/' + self.name,
                        dstPath: options.uploadDir + '/' + version + '/' + self.name
                    }, finished);
                    res[version] = options.uploadDir + '/' + version + '/' + self.name;
                });
            else
                finished();
        }
        else
            finished();
        return deep.promise(def);
    }


    var UploadHandler = function (req, options) {
        this.req = req;
        this.options = options;
        this.tmpFiles = [];
        this.files = [];
        this.fields = {};
        this.error = null;
    };
/*
    UploadHandler.prototype.get = function () {
        var handler = this,
            files = [];
        fs.readdir(this.options.uploadDir, function (err, list) {
            list.forEach(function (name) {
                var stats = fs.statSync(this.options.uploadDir + '/' + name),
                    fileInfo;
                if (stats.isFile()) {
                    fileInfo = new FileInfo({
                        name: name,
                        size: stats.size
                    });
                    fileInfo.initUrls(handler.req);
                    files.push(fileInfo);
                }
            });
            handler.callback({files: files});
        });
    };*/

    UploadHandler.prototype.post = function () {
        var def = this.deferred = deep.Deferred();
        var response = {
            files:this.files,
            fields:this.fields,
            errors:[]
        }
        var handler = this,
            form = new formidable.IncomingForm(),
            tmpFiles = this.tmpFiles,
            files = this.files,
            fields = this.fields,
            map = {},
            redirect,
            finish = function () {
                console.log("on finish")
                if(handler.aborted)
                    return;
                def.resolve(response);
            };

        form.uploadDir = this.options.tmpDir;
        form.on('fileBegin', function (name, file) {
            console.log("on file begin")
            if(handler.aborted)
                return;
            tmpFiles.push(file.path);
            var fileInfo = new FileInfo(file, handler.options, handler.req);
            
            map[path.basename(file.path)] = fileInfo;
            files.push(fileInfo);
        })
        .on('field', function (name, value) {
            console.log("on field")
            if(handler.aborted)
                return;
            fields[name] = value;
        })
        .on('file', function (name, file) {
            console.log("on file")
            if(handler.aborted)
                return;
            var fileInfo = map[path.basename(file.path)];
            fileInfo.size = file.size;

            if (!fileInfo.validate()) 
            {
                fileInfo.error = "file validation failed : unlink file !"
                response.errors.push(fileInfo.error )
                fs.unlink(file.path);
                return;
            }
        })
        .on('aborted', function () {
            if(handler.aborted)
                return;
            handler.aborted = true;
            console.log("on aborted")
            tmpFiles.forEach(function (file) {
                fs.unlink(file);
            });
            def.reject("aborted");
        })
        .on('error', function (e) {
            response.errors.push("upload error : unlink files and aborting !")
            console.log("on error")
            if(handler.aborted)
                return;
            handler.error = e;
            console.log("UploadHandler : errorr : ", e);
            tmpFiles.forEach(function (file) {
                fs.unlink(file);
            });
            //this.req.connection.destroy();
            handler.aborted = true;
            def.reject(e);
        })
        .on('progress', function (bytesReceived, bytesExpected) {
            if(handler.aborted)
                return;
            console.log("on progress",bytesReceived, "/", bytesExpected)
            if (bytesReceived > handler.options.maxPostSize)
            {
                tmpFiles.forEach(function (file) {
                    fs.unlink(file);
                });
                handler.req.connection.destroy();
                handler.aborted = true;
                 def.reject("bytes exceed");
            }
        })
        .on('end', finish)
        .parse(handler.req);
        return deep.promise(def);
    };

    UploadHandler.prototype.abort = function (argument) {
        if(this.aborted)
            return;
        this.tmpFiles.forEach(function (file) {
                fs.unlink(file);
            });
        //this.req.connection.destroy();
        this.aborted = true;
        this.deferred.reject("upload aborted");
    }

    UploadHandler.prototype.destroy = function () 
    {
        var handler = this,
            fileName;
        var def = deep.Deferred();
        if (handler.req.url.slice(0, handler.options.uploadUrl.length) === this.options.uploadUrl) {
            fileName = path.basename(decodeURIComponent(handler.req.url));
            fs.unlink(this.options.uploadDir + '/' + fileName, function (ex) 
            {
                Object.keys(handler.options.imageVersions).forEach(function (version) 
                {
                    fs.unlink(handler.options.uploadDir + '/' + version + '/' + fileName);
                });
                def.resolve({success: !ex});
            });
        } else {
            def.reject({success: false});
        }
        return deep.promise(def);
    };


/*
    var createHandlerResult = function  (request) {
        var infos = request.autobahn;
        var deferred = deep.Deferred();
        infos.handleResult = function (result, redirect) {
            if (redirect) 
            {
                deep.utils.up({
                    'Location': redirect.replace(/%s/, encodeURIComponent(JSON.stringify(result)))
                }, infos.response.headers)
                infos.response.status = 302;
                deferred.resolve(infos.response)
            } 
            else 
            {
                deep.utils.up( {
                    'Content-Type': req.headers.accept.indexOf('application/json') !== -1 ?'application/json' : 'text/plain'
                }, infos.response.headers);
                deferred.resolve(JSON.stringify(result))
            }
        };
        infos.promise = deep.promise(deferred);
    }*/

    var UploadFacet = {
        
        uploadHandler:null,
        fileServer:null,
        options:{
            tmpDir: __dirname + '/tmp',
            uploadDir: __dirname + '/public/files',
            uploadUrl: '/files/',
            maxPostSize: 11000000000, // 11 GB
            minFileSize: 1,
            maxFileSize: 10000000000, // 10 GB
            acceptFileTypes: /.+/i,
            // Files not matched by this regular expression force a download dialog,
            // to prevent executing any scripts in the context of the service domain:
            safeFileTypes: /\.(gif|jpe?g|png)$/i,
            imageTypes: /\.(gif|jpe?g|png)$/i,
            imageVersions: {
                'thumbnail': {
                    width: 80,
                    height: 80
                }
            },
            accessControl: {
                allowOrigin: '*',
                allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
            },
            /* Uncomment and edit this section to provide the service via HTTPS:
            ssl: {
                key: fs.readFileSync('/Applications/XAMPP/etc/ssl.key/server.key'),
                cert: fs.readFileSync('/Applications/XAMPP/etc/ssl.crt/server.crt')
            },
            */
            nodeStatic: {
                cache: 3600 // seconds to cache served files
            }
        },
        init:deep.compose.before(function (config) 
        {
            if(config)
                deep.utils.up( config, this.options );
          //  this.fileServer = new nodeStatic.Server(this.options.publicDir, this.options.nodeStatic),
        }),
        analyse:deep.compose.before(function (req) {
           var infos = req.autobahn;
            deep.utils.up({
                'Access-Control-Allow-Origin':this.options.accessControl.allowOrigin,
                'Access-Control-Allow-Methods':this.options.accessControl.allowMethods
            }, infos.response.headers);
            //infos.uploadHandler = new UploadHandler(req, this.options);
        }),
        accessors:{
            post:{
                handler:function (object, options) {
                    console.log("upload facet : post " , object)
                    utils.setNoCacheHeaders(options);
                    
                    return object;
                }
            },
            "delete":{
                handler:function (id, options) {
                    return options.uploadHandler.destroy();
                }
            },
           /* head:{
                handler:function  (id, options) {
                
                    if (options.url === '/') 
                    {
                        utils.setNoCacheHeaders(options);
                        return infos.response;
                    } 
                    else 
                        fileServer.serve(req, res);
                    break;
                }
            },*/
           /* get:{
                handler:function  (id, options) {
                
                    if (options.url === '/') 
                    {
                        utils.setNoCacheHeaders(options);
                        this.uploadHandler.get();
                    } 
                    else 
                        fileServer.serve(req, res);
                    break;
                }
            }*/
        }
    }
    UploadFacet.UploadHandler = UploadHandler;
    return UploadFacet;

});
