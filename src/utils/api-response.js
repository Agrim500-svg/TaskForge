//can be used on any project to handle api errors in a standard way

class ApiResponse{
    constructor(statusCode, data, message="Success"){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode<400;
    }
}

export{ApiResponse};