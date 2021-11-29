require('harmony-reflect');

var DDPServer = function(opts) {

  opts = opts || {};
  var WebSocket = require('faye-websocket'),
      EJSON = require('ejson'),
      http = require('http'),
      server = opts.httpServer,
      methods = opts.methods || {},
      collections = {},
      subscriptions = {},
      predicates = {};
      self = this;

  if (!server) {
    server = http.createServer()
    server.listen(opts.port || 3000);
  }

  server.on('upgrade', function (request, socket, body) {
    if (WebSocket.isWebSocket(request)) {
      var ws = new WebSocket(request, socket, body);
      var session_id = "" + new Date().getTime();
      subscriptions[session_id] = {};

      function sendMessage(data) {
        ws.send(EJSON.stringify(data));
      }

      ws.on('message', function(event) {
        var data = JSON.parse(event.data);

        switch (data.msg) {

        case "connect":

          sendMessage({
            msg: "connected",
            session: session_id
          });

          break;

        case "method":

          if (data.method in methods) {
            Promise.resolve(methods[data.method].apply(this, data.params))
            .then(function(result){
              sendMessage({
                msg: "result",
                id: data.id,
                result: result
              });

              sendMessage({
                msg: "updated",
                id: data.id
              })
            })
            .catch(function(e){
              console.log('ddp server error', e.message);
              sendMessage({
                msg: "result",
                id: data.id,
                error: {
                  error: 500,
                  reason: e.message,
                  errorType: "Meteor.Error"
                }
              });
            });

          } else {
              console.log("Error method " + data.method + " not found");

              sendMessage({
                msg: "result",
                id: data.id,
                error: {
                  error: 404,
                  reason: "Method not found",
                  errorType: "Meteor.Error"
                }
              });
          }
          break;

        case "sub":

          var getDocsOnSubscribe = function() { return collections[data.name]; }
          var publishAddedPredicate = () => { return true; }
          var publishChangedPredicate = () => { return true; }
          var publishRemovedPredicate = () => { return true; }
          if (data.name in predicates) {
            var predicate = predicates[data.name];
            if (predicate.getDocsOnSubscribe) {
              getDocsOnSubscribe = predicate.getDocsOnSubscribe(data.params);
            }
            if (predicate.publishAddedPredicate) {
              publishAddedPredicate = predicate.publishAddedPredicate(data.params);
            }
            if (predicate.publishChangedPredicate) {
              publishChangedPredicate = predicate.publishChangedPredicate(data.params);
            }
            if (predicate.publishRemovedPredicate) {
              publishRemovedPredicate = predicate.publishRemovedPredicate(data.params);
            }
          }

          subscriptions[session_id][data.name] = {
            added: function(id, doc) {
              sendMessage({
                msg: "added",
                collection: data.name,
                id: id,
                fields: doc
              })
            },
            changed: function(id, fields, cleared) {
              sendMessage({
                msg: "changed",
                collection: data.name,
                id: id,
                fields: fields,
                cleared: cleared
              })
            },
            removed: function(id) {
              sendMessage({
                msg: "removed",
                collection: data.name,
                id: id
              })
            },
            publishAddedPredicate,
            publishChangedPredicate,
            publishRemovedPredicate
          };

          var docs = getDocsOnSubscribe(collections[data.name]);
          for (var id in docs) {
            subscriptions[session_id][data.name].added(id, docs[id]);
          }

          sendMessage({
            msg: "ready",
            subs: [data.id]
          });

          break;

        case "ping":

          sendMessage({
            msg: "pong",
            id: data.id
          });

          break;

        default:
        }
      });

      ws.on('close', function(event) {
        delete subscriptions[session_id];
        ws = null;
        session_id = null;
      });
    }
  });

  this.methods = function(newMethods) {
    for (var key in newMethods) {
      if (key in methods)
        throw new Error(500, "A method named " + key + " already exists");
      methods[key] = newMethods[key];
    }
  }

  this.publish = function(name, predicate) {
    if (name in collections)
      throw new Error(500, "A collection named " + name + " already exists");

    predicates[name] = predicate;

    var documents = {};
    var proxiedDocuments = {};

    function add(id, doc) {
      documents[id] = doc;
      proxiedDocuments[id] = new Proxy(doc, {
        set: function(_, field, value) {
          var changed = {};
          doc[field] = changed[field] = value;
          sendChanged(id, changed, []);
          return value;
        },
        deleteProperty: function(_, field) {
          delete doc[field];
          sendChanged(id, {}, [field]);
          return true;
        }
      });
      for (var client in subscriptions)
        if (subscriptions[client][name] && subscriptions[client][name].publishAddedPredicate(id, doc))
          subscriptions[client][name].added(id, doc);
    }

    function change(id, doc) {
      var cleared = [];
      for (var field in documents[id]) {
        if (!(field in doc)) {
          cleared.push(field)
          delete documents[id][field];
        }
      }
      var changed = {};
      for (var field in doc)
        if (doc[field] != documents[id][field])
          documents[id][field] = changed[field] = doc[field];
      sendChanged(id, changed, cleared);
    }
    function sendChanged(id, changed, cleared) {
      for (var client in subscriptions)
        if (subscriptions[client][name] && subscriptions[client][name].publishChangedPredicate(id, changed, name))
          subscriptions[client][name].changed(id, changed, cleared);
    }

    function remove(id) {
      delete documents[id];
      for (var client in subscriptions)
        if (subscriptions[client][name] && subscriptions[client][name].publishRemovedPredicate(id))
          subscriptions[client][name].removed(id);
    }

    return collections[name] = new Proxy(documents, {
      get: function(_, id) {
        return proxiedDocuments[id];
      },
      set: function(_, id, doc) {
        if (documents[id])
          change(id, doc);
        else
          add(id, doc);
        return proxiedDocuments[id];
      },
      deleteProperty: function(_, id) {
        remove(id);
        return true;
      }
    });
  }
}

module.exports = DDPServer
