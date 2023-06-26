const mongoose = require('mongoose');
const UsuariosSchema = new mongoose.Schema({
    nombre:{
        type: String,
        required: true,
    },
    nombre_usuario:{
        type: String,
        required: true,
        unique: true,
    },
    correo:{
        type: String,
        required: true,
        unique: true,
    },
    contrasenia:{
        type: String,
        required: true,
    },
    fecha_nacimiento: {  
        type: Date,
        required: false,  
    },
    numero_telefono: {   
        type: String,
        required: false, 
    },
    imagen: Buffer, 
    stripeCustomerId: String,  // ID del cliente de Stripe
    firebaseUID: String // UID de firebase
});     

const usuario = mongoose.model('usuario', UsuariosSchema);
module.exports = usuario;
