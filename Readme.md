# Adyog E-commerce Backend

A robust and scalable backend API for the Adyog e-commerce platform built with Node.js, Express, and MongoDB.

## Features

- RESTful API architecture
- JWT-based authentication with refresh tokens
- Role-based access control (Customer, Seller, Admin, Super Admin)
- Product management with categories and variants
- Order processing and tracking
- Payment integration with Razorpay
- File upload with Cloudinary
- Email notifications
- Comprehensive logging with Winston
- Input validation and sanitization
- Rate limiting and security middleware

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Cloudinary
- **Payment**: Razorpay
- **Email**: Nodemailer
- **Logging**: Winston
- **Testing**: Jest, Supertest
- **Code Quality**: ESLint, Prettier, Husky

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd e-commerce_backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server
```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage

## API Documentation

The API follows RESTful conventions and includes the following main endpoints:

- `/api/v1/users` - User management
- `/api/v1/products` - Product management
- `/api/v1/orders` - Order management
- `/api/v2/payments` - Payment processing
- `/api/v2/wishlist` - Wishlist management

## Environment Variables

Required environment variables:

```
NODE_ENV=development
PORT=8000
MONGODB_URI=mongodb://localhost:27017/adyog_ecommerce
JWT_SECRET=your-jwt-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
RAZORPAY_API_KEY=your-razorpay-key
RAZORPAY_API_SECRET=your-razorpay-secret
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the ISC License.
