var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var async = require('async');
var res_dir = "./test"; //资源路径
var output_dir = "./webp"; //输出路径

var walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

//创建文件夹
var mkdirSync = function(url, mode, cb) {
  var arr = url.split("/");
  mode = mode || 0755;
  cb = cb || function() {};

  if (arr[0] === ".") {
    arr.shift();
  }

  if (arr[0] === "..") {
    arr.splice(0, 2, arr[0] + "/" + arr[1]);
  }

  function inner(cur) {
    if (!fs.existsSync(cur)) {
      fs.mkdirSync(cur, mode);
    }
    if (arr.length) {
      inner(cur + "/" + arr.shift());
    } else {
      cb();
    }
  }
  arr.length && inner(arr.shift());
};

//删除文件夹
var rmdirSync = (function() {

  function iterator(url, dirs) {
    var stat = fs.statSync(url);
    if (stat.isDirectory()) {
      dirs.unshift(url);
      inner(url, dirs);
    } else if (stat.isFile()) { //删除文件
      fs.unlinkSync(url);
    }
  }

  function inner(url, dirs) {
    var arr = fs.readdirSync(url);
    for (var i = 0, el; el = arr[i++];) {
      iterator(url + "/" + el, dirs);
    }
  }

  return function(dir, cb) {
    cb = cb || function() {};
    var dirs = [];
    if (fs.existsSync(dir)) { //路径存在才进行操作
        iterator(dir, dirs);
    }
    try {
      for (var i = 0, el; el = dirs[i++];) { //删除文件
        fs.rmdirSync(el);
      }
      cb();
    } catch (e) { //文件或目录不存在
      e.code === "ENOENT" ? cb() : cb(e);
    }
  }
})();

var binPath = './bin/webp-bin';

var done = function() {
  var t1 = Date.now();
  async.waterfall([

    function(next) {
      console.log("清空", output_dir);
      rmdirSync(output_dir, next);
    },
    function(next) {
      walk(res_dir, function(err, files) {
        if (err) {
          console.log('[ERROR] when read files ', err);
        }

        files = files.filter(function(file) {
          return /(\.png$)|(\.jpg$)/.test(file);
        });

        async.eachLimit(files, 50, function(file, cb) {
          async.waterfall([

            function(callback) { //查找输出目录，若不存在则新建
              /*
               *分离路径和文件名
               */
              var url = file.split("/");
              var name = url.pop();
              var len = name.length;
              var dir = path.join(output_dir, file.slice(res_dir.length, file.length - len));
              mkdirSync(dir);

              var outFile = path.join(dir, name);
              callback(null, outFile);
            },
            function(outFile, callback) { //匹配png和jpg文件，转换成webp文件
              if (/(\.png)/.test(outFile)) {
                outFile = outFile.replace(/(\.png)/, ".webp");
              } else if (/(\.jpg)/.test(outFile)) {
                outFile = outFile.replace(/(\.jpg)/, ".webp");
              }
              callback(null, outFile);
            },
            function(outFile, callback) { //转换并输出webp文件
              console.log('转换', file);
              var args = [file, '-o', outFile];
              exec('node ' + binPath + ' ' + args.join(' '), function(err, stdout, stderr) {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }
              });
            }
          ], function(err) {
            if (err) {
              cb(err);
            } else {
              cb();
            }
          });
        }, function(err) {
          if (err) {
            console.log(err);
          } else {
            next();
          }
        });
      });
    }
  ], function(err) {
    if (err) {
      console.log(err);
    } else {
      var t2 = Date.now();
      console.log("完成转换！！！！！！！！");
      console.log("总耗时：", (t2 - t1) + "ms");
    }
  });
};

done();