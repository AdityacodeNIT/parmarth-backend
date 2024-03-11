const asyncHandler=(fn)=>(req,res,next)=>
{
    try{
     fn(req,res,next)
    }
    catch(error){
        res.status(err.code||500).json({
            success:false,
            message:err.mesaage
        })
    }
}

export {asyncHandler}