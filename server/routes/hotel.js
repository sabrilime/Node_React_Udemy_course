import express from 'express';
import formidable from 'express-formidable';

const router = express.Router();

//middleware
import {requireSignin} from '../middlewares';
import {hotelOwner} from '../middlewares/hotel';


//controllers
import { 
    create, 
    hotels, 
    image, 
    sellerHotels, 
    read, 
    remove, 
    update,
    userHotelBookings,
    isAlreadyBooked,
    searchListings,
} from '../controllers/hotel';

router.post('/create-hotel', requireSignin, formidable(), create);
router.get('/hotels', hotels);
router.get('/hotel/image/:hotelId', image);
router.get('/seller-hotels', requireSignin, sellerHotels);
router.get('/hotel/:hotelId', read);
router.delete('/delete-hotel/:hotelId', requireSignin, hotelOwner, remove);
router.put('/update-hotel/:hotelId', requireSignin, hotelOwner, formidable(), update);
router.get('/user-hotel-bookings', requireSignin, userHotelBookings);
router.get('/is-already-booked/:hotelId', requireSignin, isAlreadyBooked);
router.post('/search-listings', searchListings);

module.exports = router;