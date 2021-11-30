# DDP Server with reactive collections

DDP-Server-Reactive is a nodejs based DDP Server.

## Usage

```
// Create a server listening on the default port 3000
var server = new DDPServer();

// Create a reactive collection
// All the changes below will automatically be sent to subscribers
var todoList = server.publish("todolist");

// Add items
todoList[0] = { title: "Cook dinner", done: false };
todoList[1] = { title: "Water the plants", done: true };

// Change items
todoList[0].done = true;

// Remove items
delete todoList[1]

// Add methods
server.methods({
  test: function() {
    return true;
  }
});
```

You can then connect to it using a ddp client such as `ddp`

## Advanced Usage

### Create a server with a different port:

```
var server = new DDPServer({ port: 80 });
```

### Create a server using an existing http server
so you use the same IP number for DDP and for web:

```
var app = express();
app.server = http.createServer(app);
var server = new DDPServer({ httpServer: app.server });
```

### Filter docs which should be published
When publishing collection you can set object with predicaments for deciding which documents should be returned
when subscribing or if subscriber should be notified when document is added, changed or removed.
All predicaments receive subscription `params` and also, depending on predicament, additional arguments.

```
var todoList = server.publish("todolist", {
    initial: (params, docs) => {
        if (params && params.lastEventId && docs) {
            const reducer = (obj, key) => ({
                ...obj,
                [key]: docs[key]
            });
            return Object.keys(docs).filter(key => key > params.lastEventId).reduce(reducer, {});
        }
        return docs;
    },
    added: (params, id, doc) => {
        if (params && params.type) {
            return params.type === doc.type;
        }
        return true;
    },
    changed: (params, id, changed, cleared) => {
        return changed.type !== undefined;
    },
    removed: (params, id) => {
        return true;
    }
});
```

It's not required to provide all fields to predicate object. If you only want to filter out
the documents that are received at subscribing then only provide object with `getDocsOnSubscribe` property.