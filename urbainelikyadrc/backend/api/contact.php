<?php

include("../utils/json.php");
include("../config/session.php");

// checkAuth(); // optional: allow anonymous contacts

// path may vary depending on include working dir
$file = realpath(__DIR__ . "/../data/contact.json") ?: (__DIR__ . "/../data/contact.json");

$data = readJson($file);

$input=json_decode(file_get_contents("php://input"),true);

$input["id"]=time();
$input["user_nom"]=$_SESSION["user_nom"];

$data[]=$input;

writeJson($file,$data);

echo json_encode(["success"=>true]);

?>