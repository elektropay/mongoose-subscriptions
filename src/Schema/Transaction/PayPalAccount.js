const mongoose = require("mongoose");

const PayPalAccount = new mongoose.Schema(
    {
        email: String,
        name: String,
        payerId: String,
        countryCode: String,
    },
    { _id: false }
);

module.exports = PayPalAccount;
