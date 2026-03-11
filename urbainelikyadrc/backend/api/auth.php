<?php

include("../utils/json.php");
include("../config/session.php");

header("Content-Type: application/json");

$file="../data/users.json";

$users = readJson($file);

$input = json_decode(file_get_contents("php://input"),true);

if($input["action"]=="register"){

    $input["id"]=time();

    $input["password"]=password_hash($input["password"],PASSWORD_DEFAULT);

    $users[]=$input;

    writeJson($file,$users);

    $_SESSION["user_id"]=$input["id"];
    $_SESSION["user_nom"]=$input["nom"];

    echo json_encode(["success"=>true]);

}


if($input["action"]=="login"){

    foreach($users as $u){

        if($u["email"]==$input["email"] && password_verify($input["password"],$u["password"])){

            $_SESSION["user_id"]=$u["id"];
            $_SESSION["user_nom"]=$u["nom"];

            echo json_encode(["success"=>true]);

            exit;
        }

    }

    http_response_code(401);

    echo json_encode(["error"=>"Identifiants incorrects"]);

}

?>