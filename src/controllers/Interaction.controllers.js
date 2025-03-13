import { UserInteraction } from "../models/userInteraction.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const saveUserInteraction = asyncHandler(async (req, res) => {
  const {action,productId} = req.body;


  if (!req.user || !productId || !action) {
    return res.status(400).json({ message: "Missing required fields" });
  }




  const interaction = new UserInteraction({
    userId: req.user._id, // Corrected key
    productId,
    action,
  });

  await interaction.save();

  res.status(201).json({ message: "User interaction saved successfully" });
});

export const getUserInteractions = asyncHandler(async (req, res) => {
  try {
    const interactions = await UserInteraction.find()
      .populate("userId") // Ensure user details are populated
      .populate("productId");

    res.json(interactions);
  } catch (error) {
    console.error("Error fetching interactions:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
