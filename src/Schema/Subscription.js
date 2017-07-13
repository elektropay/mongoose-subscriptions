const mongoose = require("mongoose");
const shortid = require("shortid");
const addmonths = require("addmonths");
const adddays = require("../adddays");
const ProcessorItem = require("./ProcessorItem");
const Descriptor = require("./Descriptor");
const originals = require("mongoose-originals");
const Discount = require("./Discount");
const Plan = require("./Plan");
const SubscriptionStatus = require("./Statuses/SubscriptionStatus");

const Subscription = new mongoose.Schema({
    _id: {
        type: String,
        default: shortid.generate,
    },
    processor: {
        type: ProcessorItem,
        default: ProcessorItem,
    },
    plan: {
        type: Plan,
        required: true,
    },
    discounts: [Discount],
    paymentMethodId: String,
    firstBillingDate: Date,
    nextBillingDate: Date,
    paidThroughDate: Date,
    failureCount: Number,
    daysPastDue: Number,
    billingPeriodEndDate: Date,
    billingPeriodStartDate: Date,
    billingDayOfMonth: Number,
    status: {
        type: String,
        enum: SubscriptionStatus.Statuses,
    },
    price: Number,
    statusHistory: [SubscriptionStatus],
    descriptor: Descriptor,
    isTrial: {
        type: Boolean,
        default: false,
    },
    deleted: Boolean,
    trialDuration: Number,
    trialDurationUnit: {
        type: String,
        enum: ["month", "day"],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date,
});

function addTrial(trialDuration, trialDurationUnit, date) {
    switch (trialDurationUnit) {
        case "day":
            return adddays(date, trialDuration);
        case "month":
            return addmonths(date, trialDuration);
        default:
            return date;
    }
}

Subscription.virtual("numberOfFreeBillingCycles").get(function numberOfFreeBillingCycles() {
    return this.discounts.reduce((max, current) => {
        const discountsPrice = this.discounts
            .filter(discount => {
                return current.numberOfBillingcyclesLeft <= discount.numberOfBillingcyclesLeft;
            })
            .map(discount => discount.amount)
            .reduce((sum, value) => sum + value, 0);

        return discountsPrice >= this.price ? current.numberOfBillingcyclesLeft : max;
    }, 0);
});

Subscription.method("initializeDates", function initializeLocalDates() {
    if (this.processor.state === ProcessorItem.LOCAL) {
        if (this.isTrial) {
            this.firstBillingDate =
                this.firstBillingDate ||
                addTrial(this.trialDuration, this.trialDurationUnit, this.createdAt);
            this.nextBillingDate = this.nextBillingDate || this.firstBillingDate;
            this.billingDayOfMonth = this.billingDayOfMonth || this.nextBillingDate.getDate();
        } else {
            this.firstBillingDate = this.firstBillingDate || this.createdAt;
            this.paidThroughDate =
                this.paidThroughDate ||
                addmonths(this.firstBillingDate, this.plan.billingFrequency);
            this.billingPeriodStartDate = this.billingPeriodStartDate || this.firstBillingDate;
            this.billingPeriodEndDate = this.billingPeriodEndDate || this.paidThroughDate;
            this.nextBillingDate = this.nextBillingDate || adddays(this.paidThroughDate, 1);
            this.billingDayOfMonth = this.billingDayOfMonth || this.nextBillingDate.getDate();
        }
    }
});

Subscription.pre("save", function(next) {
    this.initializeDates();
    next();
});

Subscription.method("addDiscounts", function addDiscounts(callback) {
    const newDiscounts = callback(this);
    const oldDiscounts = this.discounts;

    this.discounts = oldDiscounts
        .concat(newDiscounts)
        .filter(item => item)
        .map(item => {
            const itemObject = this.discounts.create(item);
            itemObject.initOriginals();
            return itemObject;
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 1);

    return this;
});

Subscription.plugin(originals, {
    fields: [
        "discounts",
        "plan",
        "paymentMethodId",
        "firstBillingDate",
        "paidThroughDate",
        "status",
        "price",
        "descriptor",
        "isTrial",
        "trialDuration",
        "trialDurationUnit",
    ],
});

Subscription.path("discounts").discriminator("DiscountAmount", Discount.DiscountAmount);
Subscription.path("discounts").discriminator("DiscountPercent", Discount.DiscountPercent);
Subscription.path("discounts").discriminator("DiscountCoupon", Discount.DiscountCoupon);
Subscription.path("discounts").discriminator(
    "DiscountPreviousSubscription",
    Discount.DiscountPreviousSubscription
);

module.exports = Subscription;
