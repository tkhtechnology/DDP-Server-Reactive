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
