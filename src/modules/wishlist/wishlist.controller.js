import { asyncHandler } from '../../utils/asyncHandler.js';
import { Wishlist } from './Wishlist.model.js';
import mongoose from 'mongoose'; // Ensure you import mongoose

const addToWishlist = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { items } = req.body;

  const wishlist = await Wishlist.findOneAndUpdate(
    { userId },
    {
      $addToSet: {
        items: {
          $each: items.map(item => ({
            productId: item.productId,
          }))
        }
      }
    },
    { new: true, upsert: true }
  );

  res.status(200).json(wishlist);
});


const retrieveWishlisted = asyncHandler(async (req, res) => {
  
  try {
    const wishlist = await Wishlist.findOne({userId: req?.user?._id})
      .populate('items.productId','name price ProductImage description')
  

    res.status(200).json(wishlist?.items||[]);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch Wishlist',
      error: error.message
    });
  }
});


const removeWishlistedItem = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOneAndUpdate(
      { userId: req.user?._id },
      { $pull: { items: { productId:new mongoose.Types.ObjectId(productId) } } },
      { new: true }
    );

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    res.status(200).json({
      message: "Item removed successfully",
      items: wishlist.items
    });
  } catch (error) {
    console.error("Error removing item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


export { addToWishlist, retrieveWishlisted, removeWishlistedItem };
