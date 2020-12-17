require('dotenv').config()
const express=require('express')
const bcrypt = require('bcrypt');
const { Validator } = require('node-input-validator');
const Admin = require('../Schema/admin');
const saltRounds=10
var jwt = require('jsonwebtoken');
const Catogry=require('../Schema/catogry')
const Vendor=require('../Schema/vendor')
const adminProduct=require('../Schema/adminProduct')
const VerificationJwt=require('../Middlewere/authenticate')
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './image/upload');
  },
  filename: function(req, file, cb) {
    cb(null,  Date.now()+ file.originalname);
  }
});
var upload  = multer({
  storage: storage,

 })


const router = express.Router();
router.post('/adminSignup',(req,res)=>{
     const v = new Validator(req.body, {
    name:'required',
    email: 'required|email',
    password: 'required'
  });
    v.check().then((matched) => {
    if (!matched) {
      res.status(422).send(v.errors);
    }
    else{
        bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
            if(err) res.status(400).json({"message":"failed in encryption",err})
             const insertData=new Admin({
             name:req.body.name,
             email:req.body.email,
             password:hash,

         })
          Admin.create(insertData)
         .then(user=>res.status(200).json({"message":"Signup Sucessfully",user}))
         .catch(err=>res.status(500).json({"message":"Internal Server error ",err}))

          });
        }
  });
});

router.post('/adminLogin',(req,res)=>{
    const v = new Validator(req.body, {
    email: 'required|email',
    password: 'required'
  });
    v.check().then((matched) => {
    if (!matched) {
      res.status(422).send(v.errors);
    }
    else{
        Admin.findOne({'email':req.body.email})
        .then(user=>{
            // console.log(user.password) console.log(req.body.password)
            bcrypt.compare(req.body.password, user.password, function(err, result) {
                if(result==true){
               let token=jwt.sign(user.toJSON(),process.env.SECRET_KEY)
               let check=user.toJSON()
               check.token=token
              res.status(200).json({"message":"login sucessfully","token":token})
                }
                else{
                    res.status(400).json({"message":"login failed wrong password"})

                }
             });
        })
        .catch(err=>res.status(400).json({"message":"email wrong",err}))
     }
   })
})

router.post('/activateDeactivate',async(req,res)=>{
    try{
        let v=await new Validator(req.body,{
            vendor_id:'required'
        })
        let check=await v.check()
        let vendor_id=v.errors.vendor_id?v.errors.vendor_id.message:','
        if(!check){
            res.status(422).json({message:vendor_id})
        }
        else{
            let get=await Vendor.findOne({_id:req.body.vendor_id})
            if(get && get.status==0){
                let set_status=await Vendor.updateOne({_id:req.body.vendor_id},{$set:{status:1}})

                  res.status(200).json({'message':'vendor is activated'})


            }
            else if(get && get.status==1){
                 let d_status=await Vendor.updateOne({_id:req.body.vendor_id},{$set:{status:0}})
                 res.status(200).json({'message':'vendor is deactivated'})

            }
            else{
                res.status(400).json({'message':'wrong id'})
            }

        }

    }
    catch(e){

        console.log(e)
        res.status(400).json({'message':'something went wrong'})
    }


})

router.post('/listMerchant',async(req,res)=>{
    try{
    let get=await Vendor.aggregate([
        {$project:{
            name:1,
            email:1,
            phone:1

        }}
    ])

res.status(200).json({
    "total_vendor":get.length,
    "venders_is ":get,

})
    }

   catch(e){
       res.send(400).json({'messagae':'something went wrong'})
   }


})

router.post('/viewMerchant',VerificationJwt,(req,res,next)=>{
    console.log('hii')
  console.log(req.userData)
  let id=req.userData._id
  let name=req.userData.name
  console.log(id,name)
 //find the merchant table name and id is valid or not

})

// add catogry like fruit vegetable
router.post('/addCatogry',async(req,res)=>{
    try{
        let v=await new Validator(req.body,{
            catogry_name:'required',

        })
        let check=await v.check();
        let catogry_err=v.errors.catogry_name?v.errors.catogry_name.message:','

        if(!check){
              res.status(422).json({
                'statusCode':422,
                "message":catogry_err});
        }
        else{

            let checkDuplicate=await Catogry.find({'catogry_name':req.body.catogry_name})
            if(checkDuplicate.length>0){
                res.status(400).json({
                     'statusCode':400,
                    "message":"this catogry is already exist"})
             }
            else{
            const insertData={
                catogry_name:req.body.catogry_name
            }
            Catogry.create(insertData)
            .then(user=>{
                res.status(200).json({
                      "statusCode":200,
                    "message":"catogry added sucessfully",
                    "catogry_id":user._id,
                   "catogry_name": user.catogry_name})
            }


            )
            .catch(err=>{
                res.status(500).json({
                    "statusCode":500,
                    "message":"internal server error",
                     "error":err})
            })
            }


        }

    }
    catch(e){
         res.status(400).json({
               'statusCode':400,
            "message":"something went wrong"})

    }


})

router.post('/addproductAdmin', upload.array('photos', 4),async(req,res)=>{
    ///catogry id ,images,name,
    // put unit price,discount price empty
    let v=await new Validator(req.body,{
           catogry_id:'required',
           product_name:'required',
           description:'required',


       })
       let check=await v.check()
         let catogry_id=v.errors.catogry_id?v.errors.catogry_id.message:','
         let product_name=v.errors.product_name?v.errors.product_name.message:','
         let description=v.errors.description?v.errors.description.message:','
         if(!check){
           res.status(422).json({'statusCode':422,"message":catogry_id+product_name+description});
         }
        let image_array=[]
        if(req.files.length==0){
             res.status(400).json({'statusCode':400,"message":'plz upload file'})
             return

        }
         for(let i=0;i<req.files.length;i++)
             image_array.push(req.files[i].filename)

             let insertData={
                 image_array:image_array,
                 catogry_id:req.body.catogry_id,
                 product_name:req.body.product_name,
                 description:req.body.description,
             }
             let get=await adminProduct.findOne({product_name:req.body.product_name})
            /// console.log(get)
             if(get){
                 res.status(400).json({'message':'duplicate'})
                 return
             }
             adminProduct.create(insertData).then((user)=>
                res.status(200).json({'message':'product added ','product':user})).
                catch((err)=>{console.log(err)
                 res.status(400).json({'message':'something went wrong'})
                })



})
//to show product on catogry wise
router.post('/fetchProductAdmin',async(req,res)=>{
    //admin product id
    try{
         let v=await new Validator(req.body,{
           catogry_id:'required',})
           let check=await v.check()
           let catogry_id=v.errors.catogry_id?v.errors.catogry_id.message:','
           if(!check){
          res.status(422).json({ 'statusCode':422,'message':catogry_id})
       }
       else{

          let get=await adminProduct.find({catogry_id:req.body.catogry_id})
          console.log(get.length)
          if(get.length>0)
         res.status(200).json({'statusCode':200,'message':get})
         else
          res.status(400).json({'statusCode':400,'message':'no data found'})
       }
    }
    catch(e){
        console.log(e)
        res.status(400).json({'message':'something went wrong'})
    }



})


module.exports=router