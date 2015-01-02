/*
 * NodeJS code.
 */
 
// Required modules.
var express = require('express'),
    http = require('http'),
    crypto = require('crypto'),
    formidable = require('formidable'),
    fs = require('fs'),
    path = require('path'),
    session = require('cookie-session'); 

var app = express();
var bbt = require('beebotte');

// Replace by your ACCESS and SECRET Kayes
var bclient = new bbt.Connector(
{
  keyId: ACCESS_KEY,
  secretKey: SECRET_KEY,
});

var getID = function (nb) {
  return crypto.randomBytes(nb || 3).toString('hex');
}

// configure Express
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'jade');
app.set('views', './views')
app.set('trust proxy', 1) // trust first proxy
app.use(session({ keys: ['key1', 'key2'] }));

app.get('/', function(req, res, next) {
  res.render('index');
});

app.post('/upload', function(req, res) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        // `file` is the name of the <input> field of type `file`
        var old_path = files.file.path,
            file_size = files.file.size,
            file_ext = files.file.name.split('.').pop(),
            index = old_path.lastIndexOf('/') + 1,
            name = files.file.name,
            file_id = getID(),
            new_path = path.join('./public/f/', file_id + '.' + file_ext);
 
        fs.readFile(old_path, function(err, data) {
            fs.writeFile(new_path, data, function(err) {
                fs.unlink(old_path, function(err) {
                    if (err) {
                        res.status(500);
                        res.json({'success': false});
                    } else {
                        res.status(200);
                        req.session.live = { 'id': file_id, 'fname': name };
                        res.json({'success': true, 'id': file_id, 'fname': name});
                    }
                });
            });
        });
    });
});

app.get( '/auth', function( req, res, next) {
  var channel = req.query.channel,
  resource = req.query.resource || '*',
  ttl = req.query.ttl || 0,
  read = req.query.read || false,
  write = req.query.write || false,
  sid = req.query.sid;
  if( !sid || !channel ) return res.status(403).send('Unauthorized');

  var to_sign = sid + ':' + channel + '.' + resource + ':ttl=' + ttl + ':read=' + read + ':write=' + write;

  var auth = bclient.sign( to_sign );
  console.log(to_sign);
  console.log(auth);
  return res.send( auth );
} );

app.param('id', function(req, res, next, fileid){
  fs.exists('./public/f/' + fileid + '.pdf', function(exists) {
    if (exists) {
      req.fileid = fileid;
      return next();
    } else {
      res.status(404);
      return res.send('File not found');
    }
  });
});

app.get( '/live', function( req, res, next) {
  if( !req.session || !req.session.live ) {
    return res.redirect('/');
  }

  var live = req.session.live;
  if( !live.id || !live.fname ) {
    return res.redirect('/');
  }
  
  fs.exists('./public/f/' + live.id + '.pdf', function(exists) {
    if (exists) {
      return res.render('presenter', { fileid: live.id, fname: live.fname });
    } else {
      res.status(404);
      return res.send('File not found');
    }
  });
});

// TODO: shall we keep this route??? /live is a better replacement to avoid presenter session hijacking!
app.get( '/p/:id', function( req, res, next) {
  res.render('presenter', { fileid: req.fileid });
});

app.get( '/v/:id', function( req, res, next) {
  res.render('viewer', { fileid: req.fileid });
});

var server = app.listen(80, function () {

  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)
})
