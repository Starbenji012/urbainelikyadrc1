<?php

include("../utils/json.php");
include("../config/session.php");

header("Content-Type: application/json");

// use absolute path for robustness
$file = realpath(__DIR__ . "/../data/signaler.json") ?: (__DIR__ . "/../data/signaler.json");

$data = readJson($file);

if($_SERVER["REQUEST_METHOD"]=="POST"){

    //checkAuth(); // allow anonymous submissions for testing

    $input=json_decode(file_get_contents("php://input"),true);

    $input["id"]=time();
    $input["user_id"]=$_SESSION["user_id"];
    $input["user_nom"]=$_SESSION["user_nom"];
    $input["statut"]="En attente";

    $data[]=$input;

    writeJson($file,$data);

    echo json_encode(["success"=>true]);

}

if($_SERVER["REQUEST_METHOD"]=="GET"){

    echo json_encode($data);

}

?>