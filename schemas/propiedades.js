const mongoose = require('mongoose');
const PropiedadesSchema = new mongoose.Schema({
    id_propiedad:String,
    id_usuario: String,
    localizacion: String,
    precio: String,
    cuartos: String,
    banios: String,
})

const propiedades = mongoose.model('propiedades', PropiedadesSchema)
module.exports = propiedades;