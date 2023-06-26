const mongoose = require('mongoose');
const DetallesPropiedadSchema = new mongoose.Schema({
    id_propiedad:String,
    max_huespedes: String,
    camas: String,
    cocina: String,
    wifi:String,
    parqueo:String,
})

const detalles_propiedad = mongoose.model('detalles_propiedad', DetallesPropiedadSchema)
module.exports = detalles_propiedad;