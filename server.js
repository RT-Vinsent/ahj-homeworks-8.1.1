const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const koaBody = require('koa-body').default;
const cors = require('@koa/cors');
const uuid = require('uuid');
const WS = require('ws');

const app = new Koa();
const router = new Router();

app.use(cors());
app.use(koaBody({
  text: true,
  urlencoded: true,
  multipart: true,
  json: true,
}));

// Создаем пустой объект для хранения соединений клиентов по их именам
const clients = {};

// POST
router.post('/', (ctx, next) => {
  const { login } = ctx.request.body;
  const params = new URLSearchParams(ctx.request.querystring);
  const { method } = { method: params.get("method") };

  console.log(login);
  console.log(method);

  // новый тикет
  if (method === 'logining') {

    if (clients[login]) {
      ctx.status = 200;
      ctx.body = { status: false, error: 'this login is logining' };
      return;
    }

    if (!clients[login]) {
      clients[login] = { name: login, ws: '' };

      ctx.status = 200;
      ctx.body = { status: true };
      return;
    }
  }

  // всё остальное для POST
  ctx.status = 400;
  ctx.body = { POST: 'not fount', };
});


function getCurrentDate() {
  const currentDate = new Date();

  // Получение компонентов даты и времени
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Месяцы нумеруются с 0 (январь) до 11 (декабрь)
  const year = currentDate.getFullYear();

  // Сборка строки в нужном формате
  const formattedDate = `${hours}:${minutes} ${day}.${month}.${year}`;

  return formattedDate;
}

function sendClientsUsers(clients) {
  const arr = [];
  for (const key in clients) {
    if (clients.hasOwnProperty(key)) {
      const value = clients[key];
      console.log(`${key}: ${value}`);
      if (clients[key].ws.readyState === WS.OPEN) {
        arr.push(key);
      }
    }
  }

  for (let i = 0; i < arr.length; i += 1) {
    if (clients[arr[i]].ws.readyState === WS.OPEN) {
      clients[arr[i]].ws.send(JSON.stringify({ chat: [ {names: arr, type: 'user'} ] } ));
    }
  }
}

app.use(router.routes());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback());
const wsServer = new WS.Server({ server, });

const chat = [
  {name: 'Витя', text: 'арбуз зелёный', date: '11:22 11.11.23', type: 'message'},
  {name: 'Миша', text: 'арбуз красный', date: '11:22 11.11.23', type: 'message'}];

wsServer.on('connection', (ws, req) => {
  console.log('connection ws');
  const { searchParams } = new URL(req.url, 'http://localhost');
  const username = searchParams.get('login');
  console.log(username);

  if (!clients[username]) {
    ws.close();
  }

  // Сохраняем соединение клиента в объекте clients
  clients[username].ws = ws;

  ws.on('message', (messageBuffer) => {
    const { message, type } = JSON.parse(messageBuffer.toString());

    if (type === 'message') {
      const newMessage = { name: username, text: message, date: getCurrentDate(), type: 'message'}
      chat.push(newMessage);

      const eventData = JSON.stringify({ chat: [newMessage] });

      Array.from(wsServer.clients)
      .filter(client => client.readyState === WS.OPEN)
      .forEach(client => client.send(eventData));
    }
  });

  ws.send(JSON.stringify({ chat }));
  sendClientsUsers(clients);

  ws.on('close', function () {
    delete clients[username];
    sendClientsUsers(clients);
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
