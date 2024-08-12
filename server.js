const express = require('express');
const mysql = require('mysql2');
const stripe = require('stripe')('sk_test_51PTtdGRtfE4gon6LZQWKMVf42iA8wcg9AOTP9CrAcoV2xxjaBYutPPCzN9YyAu1orwAKwNI91T87CWdtuDfWfC5L00ceXRgu97');
const bodyParser = require('body-parser');

const app = express();

// Middleware para servir arquivos estáticos
app.use(express.static(__dirname));

// Conexão com o banco de dados MySQL
const db = mysql.createConnection({
  host: 'localhost', // Substitua pelo host do seu banco de dados se não estiver local
  user: 'root', // Seu usuário do MySQL
  password: '', // Sua senha do MySQL
  database: 'seu_banco_de_dados' // Substitua pelo seu banco de dados
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err);
    return;
  }
  console.log('Conectado ao MySQL');
});

// Rota inicial para servir a página HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Rota para receber os dados de pagamento do Stripe via webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_c5550d8477155915e7ffbe476637283269cb21077d8bd13607827880f262ec7f'; // Substitua pela sua chave secreta do webhook

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('Evento recebido:', event);
  } catch (err) {
    console.error('Erro ao validar webhook:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'charge.succeeded') {
    const charge = event.data.object;

    // Salvar os dados de pagamento no MySQL
    const query = 'INSERT INTO pagamentos (id, valor, moeda, status) VALUES (?, ?, ?, ?, )';
    const values = [charge.id, charge.amount, charge.currency, charge.status];

    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Erro ao inserir dados no MySQL:', err);
        return res.status(500).send('Erro ao salvar os dados de pagamento');
      }
      console.log('Dados de pagamento salvos com sucesso:', results);
      res.status(200).send('Dados de pagamento recebidos e salvos com sucesso');
    });
  } else if (event.type === 'charge.updated') {
    const charge = event.data.object;

    // Atualizar os dados de pagamento no MySQL
    const query = 'UPDATE pagamentos SET valor = ?, moeda = ?, status = ? WHERE id = ?';
    const values = [charge.amount, charge.currency, charge.status, charge.id];

    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Erro ao atualizar dados no MySQL:', err);
        return res.status(500).send('Erro ao atualizar os dados de pagamento');
      }
      console.log('Dados de pagamento atualizados com sucesso:', results);
      res.status(200).send('Dados de pagamento atualizados com sucesso');
    });
  } else {
    console.log(`Evento não tratado: ${event.type}`);
    res.status(200).send('Evento não tratado');
  }
});

// Middleware para parsear dados do body das requisições
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Variável para controlar o estado de autenticação
let isAuthenticated = false;

app.post('/admin', (req, res) => {
  const { username, password } = req.body;

  // Consulta SQL para verificar usuário e senha
  const query = 'SELECT * FROM adm WHERE usuario = ? AND senha = ?';
  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Erro ao consultar o banco de dados:', err);
      return res.status(500).json({ success: false, message: 'Erro ao verificar o usuário' });
    }

    if (results.length > 0) {
      isAuthenticated = true; // Marca o usuário como autenticado
      res.status(200).json({ success: true, message: 'Login de administrador bem-sucedido!' });
    } else {
      isAuthenticated = false; // Marca o usuário como não autenticado
      res.status(401).json({ success: false, message: 'Usuário ou senha incorretos' });
    }
  });
});

// Rota para a página de gerenciamento protegida
app.get('/management', (req, res) => {
  if (isAuthenticated) {
    res.sendFile(__dirname + '/management.html');
  } else {
    res.status(401).send('Acesso não autorizado'); // Ou redirecione para a página de login
  }
});

// Rota para a página de doação
app.get('/doar', (req, res) => {
  res.sendFile(__dirname + '/doar.html');
});

// Rota para a página de admin
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

app.get('/avaliar', (req, res) => {
  res.sendFile(__dirname + '/avaliar.html');
});

// Iniciar o servidor
const port = 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
