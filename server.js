require('dotenv').config({ path: './configDB/credentials.env' });
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = require('firebase/auth');
const { firebaseConfig, mongoUri } = require('./configDB/config');


const app = express();
const appFirebase = initializeApp(firebaseConfig);
const port = 3000;

// Configurando multer para manejar la subida de archivos
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Schemas
const Usuario = require("./schemas/usuarios");
const Favorito = require("./schemas/favoritos");
const Alojamiento = require("./schemas/alojamientos");

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

mongoose.connection.once('open', () => {
  console.log("Conectado a mongo")
})

app.post('/logIn', async (req, res) => {
  const { correo, contrasenia } = req.body;
  try {
    if (!correo.trim() || !contrasenia.trim()) {
      return res.status(400).json({ error: 'Error falta el Usuario o Contraseña ' });
    }
    const auth = getAuth();
    let firebaseUID = '';
    try {
      const userCredential = await signInWithEmailAndPassword(auth, correo, contrasenia);
      const user = userCredential.user;
      firebaseUID = user.uid;
    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      return res.status(500).send({
        "msg": "Credenciales incorrectas"
      });
    }

    const usuario = await Usuario.findOne({ firebaseUID });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
      success: true,
      usuario: {
        nombre: usuario.nombre,
        nombre_usuario: usuario.nombre_usuario,
        correo: usuario.correo,
        id: usuario._id,
        stripeCustomerId: usuario.stripeCustomerId,
        firebaseUID: usuario.firebaseUID
      }
    });
  } catch (error) {
    console.log('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

app.get('/logOut', (req, res) => {
  const auth = getAuth();
  signOut(auth)
    .then(() => {
      res.status(200).send({
        "msg": "Cierre de sesión exitoso"
      })
    })
    .catch((error) => {
      res.status(500).send({
        "msg": "Error al cerrar sesión"
      })
    });
});

app.post('/agregarUsuario', async (req, res) => {
  const { nombre, nombre_usuario, contrasenia, correo } = req.body;
  try {
    // Comprueba si ya existe un usuario con el mismo nombre de usuario
    const usuarioExistente = await Usuario.findOne({
      $or: [
        { nombre_usuario: nombre_usuario },
        { correo: correo }
      ]
    });
    if (usuarioExistente) {
      let errorMessage = '';
      if (usuarioExistente.nombre_usuario === nombre_usuario) {
        errorMessage = 'Ya existe un usuario con ese nombre de usuario';
      } else {
        errorMessage = 'Ya existe un usuario con ese correo electrónico, por favor Inicia Sesion';
      }
      return res.status(400).json({ error: errorMessage });
    }

    const nuevoUsuario = new Usuario({ nombre, nombre_usuario, contrasenia, correo });

    // Crea un nuevo cliente en Stripe
    const customer = await stripe.customers.create({ email: correo });
    nuevoUsuario.stripeCustomerId = customer.id;

    // Crea el usuario en firebase
    const auth = getAuth();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, correo, contrasenia);
      const user = userCredential.user;
      nuevoUsuario.firebaseUID = user.uid;
    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      return res.status(500).send("El usuario no pudo ser creado en firebase");
    }

    await nuevoUsuario.save();
    console.log('Usuario creado');
    res.json(nuevoUsuario);
  } catch (error) {
    console.log('Error al agregar usuario:', error);
    res.status(500).send({ error: error.message });
  }
});

app.get('/usuario/:firebaseUID', async (req, res) => {
  try {
    const { firebaseUID } = req.params;
    const user = await Usuario.findOne({ firebaseUID: firebaseUID });
    if (!user) {
      return res.status(404).send('No se encontró al usuario con ese ID.');
    }
    res.send(user);
  } catch (error) {
    res.status(500).send('Ocurrió un error en el servidor.');
  }
});

app.post('/crearAlojamiento', upload.single('img'), async (req, res) => {
  try {
    
    const alojamiento = new Alojamiento({
      idAlojamiento: req.body.idAlojamiento,
      nombre: req.body.nombre,
      ubicacion: req.body.ubicacion,
      precio: req.body.precio,
      personas: req.body.personas,
      imgSrc: req.body.imgSrc,
      fechaEntrada: req.body.fechaEntrada,
      fechaSalida: req.body.fechaSalida,
      estrellas: req.body.estrellas,
      resenas: req.body.resenas,
      tipo: req.body.tipo,
    });

    const newAlojamiento = await alojamiento.save();

    res.status(201).json(newAlojamiento);
  } catch (error) {
    console.error('Error creando alojamiento: ', error);
    res.status(500).json({ error: 'Error creando alojamiento' });
  }
});

app.get('/alojamientos/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params;
    const alojamientosPorTipo = await Alojamiento.find({ tipo: tipo }).select('+imgSrc');
    res.status(200).json(alojamientosPorTipo);
  } catch (error) {
    console.error('Error obteniendo alojamientos: ', error);
    res.status(500).json({ error: 'Error obteniendo alojamientos' });
  }
});

app.get('/buscarAlojamiento/:ubicacion', async (req, res) => {
  try {
    const { ubicacion } = req.params;
    const alojamientosPorUbicacion = await Alojamiento.find({ ubicacion: new RegExp(ubicacion, 'i') });
    res.status(200).json(alojamientosPorUbicacion);
  } catch (error) {
    console.error('Error obteniendo alojamientos: ', error);
    res.status(500).json({ error: 'Error obteniendo alojamientos' });
  }
});

//Endpoint Para buscar obtener info de alojamiento
app.get('/obtenerInfoAlojamiento/:idAlojamiento', async (req, res) => {
  try {
    const {idAlojamiento} = req.params;
    const document = await Alojamiento.find({ idAlojamiento: idAlojamiento });
    res.json(document);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo informacion de alojamiento' });
  }
});

app.put('/reservar/:idAlojamiento', (req, res) => {
  const idAlojamiento = req.params.idAlojamiento;
  
  Alojamiento.findOne({ idAlojamiento: idAlojamiento })
    .then(alojamiento => {
      if (alojamiento.reservado == '1') {
        res.status(400).json({ error: 'El alojamiento ya está reservado' });
      } else {
        Alojamiento.updateOne({ idAlojamiento: idAlojamiento }, { $set: { reservado: '1' } })
          .then(result => {
            res.status(200).json({ message: 'Alojamiento reservado con éxito' });
          })
          .catch(error => {
            res.status(500).json({ error: 'Hubo un error al reservar el alojamiento' });
          });
      }
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).json({ error: 'Hubo un error al buscar el alojamiento' });
    });
});

app.get('/favoritos', (req, res) => {
  Favorito.find({ uidUsuario: req.body.uidUsuario })
    .then(favoritos => {
      res.json(favoritos);
    })
    .catch(error => {
      console.log('Error al obtener favoritos:', error);
      res.status(500).json({ error: 'Error al obtener favoritos' });
    });
});

app.post('/agregarFavorito', (req, res) => {
  const nuevoFavorito = new Favorito({
    id: req.body.id,
    uidUsuario: req.body.uidUsuario,
    idAlojamiento: req.body.idAlojamiento
  });

  nuevoFavorito.save()
    .then(favorito => {
      res.json(favorito);
    })
    .catch(error => {
      res.status(500).send(error);
    });
});

app.delete('/eliminarFavorito', (req, res) => {
  const { uidUsuario, idAlojamiento } = req.body;

  Favorito.deleteOne({ uidUsuario: uidUsuario, idAlojamiento: idAlojamiento })
    .then(result => {
      if (result.deletedCount === 0) {
        res.status(404).json({ message: 'Favorito no encontrado con el uidUsuario y idAlojamiento proporcionados' });
      } else {
        res.json({ message: 'Favorito eliminado con éxito' });
      }
    })
    .catch(error => {
      console.log('Error al eliminar favorito:', error);
      res.status(500).json({ error: 'Ocurrió un error al eliminar el favorito' });
    });
});

app.post('/addCard', async (req, res) => {
  const { firebaseUID } = req.body;
  const { card } = req.body;
  try {
    // Busca al usuario en la base de datos
    const user = await Usuario.findOne({ firebaseUID: firebaseUID });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Añade la tarjeta al cliente de Stripe
    const source = await stripe.customers.createSource(user.stripeCustomerId, { source: card });
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/cards', async (req, res) => {
  const { firebaseUID } = req.body;
  try {
    // Busca al usuario en la base de datos
    const user = await Usuario.findOne({ firebaseUID: firebaseUID });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Obtiene las tarjetas del cliente de Stripe
    const cards = await stripe.customers.listSources(user.stripeCustomerId, { object: 'card', limit: 3 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/deleteCard/:firebaseUID/:cardId', async (req, res) => {
  const { firebaseUID, cardId } = req.params;

  try {
    // Busca al usuario en la base de datos
    const user = await Usuario.findOne({ firebaseUID: firebaseUID });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Elimina la tarjeta del cliente de Stripe
    const card = await stripe.customers.deleteSource(
      user.stripeCustomerId,
      cardId
    );
    res.json(card);
  } catch (error) {
    console.log('Error al eliminar tarjeta:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
