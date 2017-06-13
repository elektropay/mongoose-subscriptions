const mongoose = require("mongoose");
const CouponError = require("../CouponError");
const CouponAmount = require("./Coupon/Amount");
const CouponPercent = require("./Coupon/Percent");

const Schema = mongoose.Schema;

const Coupon = new Schema({
    name: String,
    description: String,
    numberOfBillingCycles: {
        type: Number,
        min: 1,
    },
    createdAt: Date,
    updatedAt: Date,
    startAt: Date,
    expireAt: Date,
    usedCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    usedCountMax: {
        type: Number,
        min: 0,
        default: Infinity,
    },
});

function isExpired(currentDate) {
    const date = (currentDate && new Date(currentDate)) || Date.now();

    return Boolean(this.expireAt && date > this.expireAt);
}

function isUseLimitReached() {
    return Boolean(this.usedCountMax && this.usedCount > this.usedCountMax);
}

Coupon.method("isExpired", isExpired);
Coupon.method("isUseLimitReached", isUseLimitReached);

function validateState(coupon) {
    if (coupon === null) {
        return new CouponError("Invalid promocode");
    } else if (coupon.isExpired()) {
        return new CouponError("Promocode expired");
    } else if (coupon.isUseLimitReached()) {
        return new CouponError("Promocode limit reached");
    }
    return null;
}

function findOneAndValidate(query) {
    return this.findOne(query).then(coupon => {
        const error = this.validateState(coupon);
        if (error) {
            throw error;
        }

        return coupon;
    });
}

Coupon.static("validateState", validateState);
Coupon.static("findOneAndValidate", findOneAndValidate);

Coupon.CouponAmount = CouponAmount;
Coupon.CouponPercent = CouponPercent;

module.exports = Coupon;
