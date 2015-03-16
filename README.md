## DDP Server with reactive collections

DDP-Server-Reactive is a nodejs based DDP Server.

### Usage

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

### Advanced Usage

Create a server with a different port:

```
var server = new DDPServer({ port: 80 });
```

Create a server using an existing http server
so you use the same IP number for DDP and for web:

```
var app = express();
app.server = http.createServer(app);
var server = new DDPServer({ httpServer: app.server });
```
