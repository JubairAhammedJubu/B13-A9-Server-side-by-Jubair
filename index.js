const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
const {createRemoteJWKSet, jwtVerify} = require("jose-cjs");
dontenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



async function run() {
  try {
    // await client.connect();

    const db = client.db("sportnest");
    const facilityCollection = db.collection("facilities");
    const bookingCollection = db.collection("bookings");

    app.get("/featured", async (req, res) => {
      const result = await facilityCollection.find().limit(6).toArray();
      res.json(result);
    });

    app.get("/facility", async (req, res) => {
      const {search, type} = req.query;

      let query = {};

      // name search (case-insensitive)
      if (search) {
        query.name = {
          $regex: search,
          $options: "i",
        };
      }

      //type filter
      if (type) {
        query.facility_type = {
          $regex: type,
          $options: "i",
        };
      }

      try {
        const result = await facilityCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({message: "Server error"});
      }
    });

    app.post("/facility",verifyToken, async (req, res) => {
      const facilityData = req.body;
      console.log(facilityData);
      const result = await facilityCollection.insertOne(facilityData);

      res.json(result);
    });

    app.get("/facility/:id", verifyToken, async (req, res) => {
      const {id} = req.params;

      const result = await facilityCollection.findOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    app.patch("/facility/:id", async (req, res) => {
      const {id} = req.params;
      const updatedData = req.body;
      console.log(updatedData);

      const result = await facilityCollection.updateOne(
        {_id: new ObjectId(id)},
        {$set: updatedData},
      );

      res.json(result);
    });

    app.delete("/facility/:id", async (req, res) => {
      const {id} = req.params;
      const result = await facilityCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    app.get("/booking/:email", async (req, res) => {
      const {email} = req.params;

      const result = await bookingCollection
        .find({user_email: email})
        .toArray();

      res.json(result);
    });

    app.post("/booking", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;

        const {facility_id} = bookingData;

        // validation
        if (!facility_id) {
          return res.status(400).json({
            message: "facility_Id is required",
          });
        }

        // check facility exists
        const facility = await facilityCollection.findOne({
          _id: new ObjectId(facility_id),
        });

        if (!facility) {
          return res.status(404).json({
            message: "Facility not found",
          });
        }

        // insert booking
        const result = await bookingCollection.insertOne({
          ...bookingData,
          status: "pending",
          bookedAt: new Date(),
        });

        // update facility
        await facilityCollection.updateOne(
          {_id: new ObjectId(facility_id)},
          {
            $inc: {
              booking_count: 1,
            },
            $set: {
              status: "booked",
              lastBookedAt: new Date(),
            },
          },
        );

        res.status(201).json({
          success: true,
          message: "Booking successful",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.log(error);
        res.status(500).json({
          message: "Server error",
        });
      }
    });

    app.delete("/booking/:bookingId", verifyToken, async (req, res) => {
      const {bookingId} = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(bookingId),
      });

      res.json(result);
    });

    
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
