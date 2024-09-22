import mongoose, { Schema } from "mongoose";

const AddressSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    streetAddress: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },

    phoneNumber: {
      type: String,
      required: true,
    },
    alternateNumber: {
      type: String,
      required: true,
    },
  },

  { timestamps: true },
);

export const Address = mongoose.model("Address", AddressSchema);
