const mongoose = require('mongoose');
const FavoritosSchema = new mongoose.Schema({
    id:String,
    uidUsuario: String,
    idAlojamiento: String
})

FavoritosSchema.index({ uidUsuario: 1, idAlojamiento: 1 }, { unique: true });

const favorito = mongoose.model('favorito', FavoritosSchema)
module.exports = favorito;