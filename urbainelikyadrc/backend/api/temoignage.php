<?php

include("../utils/json.php");
include("../config/session.php");

header("Content-Type: application/json");

$file="../data/temoignage.json";

$data = readJson($file);

if($_SERVER["REQUEST_METHOD"]=="POST"){

    checkAuth();

    $input=json_decode(file_get_contents("php://input"),true);

    $input["id"]=time();
    $input["user_nom"]=$_SESSION["user_nom"];

    $data[]=$input;

    writeJson($file,$data);

    echo json_encode(["success"=>true]);

}

if($_SERVER["REQUEST_METHOD"]=="GET"){

    echo json_encode($data);

}

?>