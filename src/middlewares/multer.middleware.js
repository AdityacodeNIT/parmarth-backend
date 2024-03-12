import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);

    // we have to do some changes after the product is completed
    // for example  file.original name  need to be changed with unique suffix which i will do further
  },
});

const upload = multer({ storage: storage });

export { upload };
