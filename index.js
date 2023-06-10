require('dotenv').config();
const express = require('express');
var jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// ...............jwt verify.................
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res.status(403).send({ error: true, message: 'unauthorized access ' })
        }
        req.decode = decode;
        next();
    })
}
// ...............jwt verify.................



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xsalsjk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {

    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const dbConnect = async () => {
    try {
        client.connect();
        console.log(" Database Connected Successfully✅ ");

    } catch (error) {
        console.log(error.name, error.message);
    }
}
dbConnect();


const userCollection = client.db("GLADB").collection("users");
const classCollection = client.db("GLADB").collection("class");
const cartCollection = client.db("GLADB").collection("carts");
const paymentCollection = client.db("GLADB").collection("payments");

app.get('/', (req, res) => {
    res.send('Language is Coming soon')
})


// ..........verifyAdmin...............
const verifyAdmin = async (req, res, next) => {
    const email = req.decode.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);

    if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
    }
    next()
}
// ..........verifyAdmin...............

// ..........verifyInstructor...............
const verifyInstructor = async (req, res, next) => {
    const email = req.decode.email;
    const query = { email: email }
    const user = await userCollection.findOne(query);

    if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
    }
    next()
}
// ..........verifyInstructor...............


// jwt
app.post('/jwt', (req, res) => {
    const user = req.body
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: '1h'
        })
    res.send({ token })
})

// class
app.get('/class', async (req, res) => {
    const result = await classCollection.find().toArray();
    res.send(result);
})

app.post('/class', verifyJWT, verifyInstructor, async (req, res) => {
    const newItem = req.body
    const result = await classCollection.insertOne(newItem)
    res.send(result)
})

// ................my class..........

app.get('/my-class', async (req, res) => {
    const email = req.query.email;

    // if (!email) {
    //     res.send([])
    // }

    // const decodedEmail = req.decode.email;
    // if (decodedEmail !== email) {
    //     return res.status(403).send({ error: true, message: 'forbidden access' })
    // }

    const query = { instructorEmail: email }
    const result = await classCollection.find(query).toArray();
    res.send(result);
})
// ................my class..........
// ................Approved class..........

app.patch('/approved-class/:id', async (req, res) => {
    const id = req.params.id;
    const status = req.body.status;
    const feedback = req.body.feedback;
    const filter = { _id: new ObjectId(id) }

    if (status === 'approved') {
        const updateDoc = {
            $set: {
                status: 'approved'
            }
        };
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);

    } if (status === 'denied') {
        const updateDoc = {
            $set: {
                status: 'denied',
                feedback: feedback
            }
        };
        const result = await classCollection.updateOne(filter, updateDoc);
        res.send(result);
    }
})

// ................Approved class..........


// ..............users................
app.get('/instructors', async (req, res) => {
    const query = { role: 'instructor' }
    const result = await userCollection.find(query).toArray();
    res.send(result)
})

app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
    const result = await userCollection.find().toArray()
    res.send(result);
})

app.get('/users/role/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email: email }

    const user = await userCollection.findOne(query)
    const result = { role: user?.role }
    res.send(result)
})

app.post('/users', async (req, res) => {
    const user = req.body
    const query = { email: user.email }
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
        return;
    }
    const result = await userCollection.insertOne(user)
    res.send(result);
})


app.patch('/users/role/:id', async (req, res) => {
    const id = req.params.id;
    const role = req.body.role;
    const filter = { _id: new ObjectId(id) }

    if (role === 'admin') {
        const updateDoc = {
            $set: {
                role: 'admin'
            }
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
    } else {
        const updateDoc = {
            $set: {
                role: 'instructor'
            }
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
    }

})
// ..............users................

// ..............carts................
app.get('/carts', verifyJWT, async (req, res) => {
    const email = req.query.email;
    if (!email) {
        res.send([])
    }

    const decodedEmail = req.decode.email;
    if (decodedEmail !== email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
    }

    const query = { email: email }
    const result = await cartCollection.find(query).toArray();
    res.send(result);
})

app.post('/carts', async (req, res) => {
    const item = req.body;
    const result = await cartCollection.insertOne(item)
    res.send(result)
})

app.delete('/carts/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) }
    const result = await cartCollection.deleteOne(query);
    res.send(result)
})
// ..............carts................


// ...........payment intent............
app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body;
    const amount = price * 100;
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
    })
    res.send({
        clientSecret: paymentIntent.client_secret
    })
})

// payment
app.post('/payments', verifyJWT, async (req, res) => {
    const payment = req.body;
    const result = await paymentCollection.insertOne(payment);
    const query = { _id: { $in: payment.cartItemID.map(id => new ObjectId(id)) } }
    const deletedResult = await cartCollection.deleteMany(query);
    res.send({ result, deletedResult })
})
// ...........payment intent............
// ............



app.listen(port, () => {
    console.log(`Global Language on port ${port}`);
})