const express = require('express')
const app = express()
const cors =require("cors")
require('dotenv').config()
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.Payment_secret);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port =process.env.PORT || 5000;


// middleware 
app.use(cors())
app.use(express.json())









const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.1hhdzxu.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
 const menuCollection =client.db("bistroDB").collection("menu");
 const cartsCollection =client.db("bistroDB").collection("carts");
 const usersCollection =client.db("bistroDB").collection("users");
 const paymentsCollection =client.db("bistroDB").collection("payments");


// my created midlleware
const veryfytoken=(req,res,next)=>{
  if(!req.headers.authorization){
    return res.status(401).send({message:"forbidden"})
  }

  const token =req.headers.authorization.split(" ")[1];
  

  jwt.verify(token,process.env.JWT_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message:"forbidden"})
    }
    req.decoded =decoded;
    next()
  })
  

}

// after verifying tooken
const verifyadmin =async (req,res,next)=>{
  const email=req.decoded.email;

  const query ={email:email}
  const resalt=await usersCollection.findOne(query);
  console.log(resalt)

  const isAdmin =resalt.role == "admin"
  if(!isAdmin){
   return  res.status(403).send({message:"unauthorized"})
  }
  next()
  
}


// json web token


app.post("/jwt",async (req,res)=>{
  const user=req.body;
 console.log(user)
  const token=jwt.sign(user,process.env.JWT_SECRET,{
    expiresIn:"1h"
  })
  res.send({token})
})

 app.get("/menu",async (req,res)=>{
    const result =await menuCollection.find().toArray();
    res.send(result)
 })

// admin related api


app.get("/user/admin/:email",veryfytoken,async(req,res)=>{

  const email=req.params.email;
  if(!email==req.decoded.email){
    return res.status(401).send({meassage:"anauthorized bhao"})
  }
   



  const query ={email:email}

  const result =await usersCollection.findOne(query);

  let admin =false;

  if(result){
    admin =result?.role == "admin"
  }

  res.send({admin})
})

//carts apis



app.get("/carts",async(req,res)=>{
  const email=req.query.email;
  console.log(email)
  const query ={
    email:email
  }
  const result =await cartsCollection.find(query).toArray();
  res.send(result);
})

app.post("/carts",async(req,res)=>{

  const cartitem =req.body;
  console.log(cartitem)
  const result =await cartsCollection.insertOne(cartitem);
  res.send(result);

})


app.delete("/carts/:id",async (req,res)=>{
  const id =req.params.id;
  const query ={_id :new ObjectId(id)};
  const result = await cartsCollection.deleteOne(query);
  res.send(result)
})

// user related apis


app.get("/users",veryfytoken,verifyadmin,async(req,res)=>{

  console.log(req.headers)
  const result =await usersCollection.find().toArray();
  res.send(result)
})
app.post("/users",async (req,res)=>{
  const userinfo =req.body;
  const query ={email:userinfo.email}

  const isUserExist=await usersCollection.findOne(query)

  if(isUserExist){
    return res.send({message:"users exist",insertedId:null})
  }
  const result =await usersCollection.insertOne(userinfo);
  res.send(result);

})
  

app.patch("/admin/users/:id",async(req,res)=>{
  const id =req.params.id;
  console.log(id)
  const filter ={_id:new ObjectId(id)};


   const updatedoc={
    $set:{
      role:"admin"
    }
   }
  const result =await  usersCollection.updateOne(filter,updatedoc);
  res.send(result)
})

app.delete("/users/:id",async(req,res)=>{
  const id =req.params.id;
  const query ={_id :new ObjectId(id)};
  const result =await usersCollection.deleteOne(query);
 res.send(result);
})
    




// payment


app.post("/create-payment-intent", async (req, res) => {

  const{price} =req.body;
  
  if(price){
    const amount =parseInt(price * 100)
    const paymentIntent = await stripe.paymentIntents.create({
      amount:amount ,
      currency: "usd",
      payment_method_types:["card"]
    });
  
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  }

  

  
});


app.get("/payment/:email",async(req,res)=>{
  console.log("from payment",req.params.email)
  const query = {email:req.params.email}
  const result = await paymentsCollection.find(query).toArray();
  res.send(result)
})



app.post("/payment",async(req,res)=>{
  const payment =req.body;
  const {cartId} =req.body

  console.log(req.body);
  const result =await paymentsCollection.insertOne(payment);

  const query ={_id:{
    $in: cartId.map(id=> new ObjectId(id))
  }}

  const deleteresult =await cartsCollection.deleteMany(query)
  res.send({result,deleteresult})


})




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('BISTRO BOSS SERVER IS RUNNIG!')
})

app.listen(port, () => {
  console.log(`Bistro app listening on port ${port}`)
})