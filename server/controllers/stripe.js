import User from '../models/user';
import Hotel from '../models/hotel';
import Stripe from 'stripe';
import queryString from 'query-string';
import Order from '../models/order';

const stripe = Stripe(process.env.STRIPE_SECRET);

export const createConnectAccount = async (req, res) => {
    //console.log('REQ USER FROM REQUIRE SIGNIN MIDDLER', req.auth)

    //Find user from db
    const user = await User.findById(req.auth._id).exec();
    //if user don't have stripe_account_id yet, create one
    if(!user.stripe_account_id) {
        const account = await stripe.account.create({
            type: "express",
        });
        user.stripe_account_id = account.id;
        user.save();
    }
    //Create account link based on account id
    let accountLink = await stripe.accountLinks.create({
        account: user.stripe_account_id,
        refresh_url: process.env.STRIPE_REDIRECT_URL,
        return_url: process.env.STRIPE_REDIRECT_URL,
        type: 'account_onboarding',
    });
    //prefill any info such email
    accountLink = Object.assign(accountLink, {
        "stripe_user[email]": user.email || undefined,
    });

    let link = `${accountLink.url}?${queryString.stringify(accountLink)}`;
    res.send(link);
    
};

const updateDelayDAys = async (accountId) => {
    const account = await stripe.accounts.update(accountId, {
        settings: {
            payouts: {
                schedule: {
                    delay_days: 7,
                },
            },
        },
    });
    return account;
};

export const getAccountStatus = async (req, res) => {
    const user = await User.findById(req.auth._id).exec();
    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    //console.log('USER ACCOUNT RETRIEVE', account)
    //update delay days
    const updatedAccount = await updateDelayDAys(account.id);
    const updatedUser = await User.findByIdAndUpdate(
        user._id, 
        {
            stripe_seller: updatedAccount,
        }, 
        { new: true }
    ).select("-password").exec();

    res.json(updatedUser);
};

export const getAccountBalance = async (req, res) => {
    const user = await User.findById(req.auth._id).exec();
    try {
        const balance = await stripe.balance.retrieve({
            stripeAccount: user.stripe_account_id,
        });
        res.json(balance);
    } catch(err) {
        console.log(err)
    }
};

export const payoutSetting = async (req, res) => {
    try {
        const user = await User.findById(req.auth._id).exec();
        const loginLink = await stripe.accounts.createLoginLink(user.stripe_account_id, {
            redirect_url: process.env.STRIPE_SETTING_REDIRECT_URL,
        });
        res.json(loginLink);
    } catch(err) {
        console.log('STRIPE PAYOUT SETTING ERROR', err)
    }
};

export const stripeSessionId = async (req, res) => {
    //get hotel id
    const { hotelId } = req.body;
    //find hotel based on hotel id
    const item = await Hotel.findById(hotelId).populate('postedBy').exec();
    //20% charge as application fee
    const fee = (item.price * 20) / 100;
    //create a session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        //purshasing item details
        line_items: [{
            quantity: 1,
            price_data: {
                currency: 'usd',
                unit_amount: item.price * 100, //in cents
                product_data: {
                    name: item.title,
                }
            },
        }],
        mode: 'payment',
        //create payment intent with app fee and destination charge
        payment_intent_data: {
            application_fee_amount: fee * 100,
            //this seller can see his balance in frontend dashboard
            transfer_data: {
                destination: item.postedBy.stripe_account_id,
            },
        },
        //success and cancel urls
        success_url: `${process.env.STRIPE_SUCCESS_URL}/${item._id}`,
        cancel_url: process.env.STRIPE_CANCEL_URL,
    });
    //add this session object to user in the DB
    await User.findByIdAndUpdate(req.auth._id, {stripeSession: session}).exec();
    //send session id as response to frontend
    res.send({
        sessionId: session.id,
    });
};

export const stripeSuccess = async(req, res) => {
    try {
        const {hotelId} = req.body;
        const user = await User.findById(req.auth._id).exec();
        // check if user has stripeSession
        if(!user.stripeSession) return;
        //retrieve stripe session based on session id
        const session = await stripe.checkout.sessions.retrieve(user.stripeSession.id);
        // if session payment status is paid, create order
        if(session.payment_status === 'paid') {
            //check if order with that session id already exist
            const orderExist = await Order.findOne({'session.id': session.id}).exec();
            if(orderExist) {
                // if order exist, send success true
                res.json({success: true});
            } else {
                // create new order and send success true
                let newOrder = await new Order({
                    hotel: hotelId,
                    session,
                    orderedBy: user._id,
                }).save();
                // remove user's stripeSession
                await User.findByIdAndUpdate(user._id, {
                    $set: {stripeSession: {} },
                });
                
                res.json({ success: true });
            }
        }
    } catch (err) {
        console.log("STRIPE SUCCESS ERROR", err);
    }
};