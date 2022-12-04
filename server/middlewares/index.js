/*import expressJwt from "express-jwt";

export const requireSignin = expressJwt({
    // secret, expiryDate
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
});*/

/*import { expressjwt } from "express-jwt"

export const requireSignin = expressjwt({
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
});
  
export default requireSignin;*/

import { expressjwt } from "express-jwt";

export const requireSignin = expressjwt({
    secret: process.env.JWT_SECRET,
    algorithms: ["HS256"],
});

export default requireSignin;