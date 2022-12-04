import Hotel from '../models/hotel';

export const hotelOwner = async (req, res, next) => {
    let hotel = await Hotel.findById(req.params.hotelId).exec();
    let owner = hotel.postedBy._id.toString() === req.auth._id.toString();
    if(!owner) {
        return res.status(403).send('Unauthorized');
    }
    next();
}