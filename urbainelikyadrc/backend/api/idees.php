<?php

include("../utils/json.php");
include("../config/session.php");

header("Content-Type: application/json");

// use absolute path to avoid issues when called from different cwd
$file = realpath(__DIR__ . "/../data/idees.json") ?: (__DIR__ . "/../data/idees.json");

$data = readJson($file);

if($_SERVER["REQUEST_METHOD"]=="POST"){

    // authentication optional for easier testing; session cookies must be sent by the client
    //checkAuth();

    $input=json_decode(file_get_contents("php://input"),true);
    if(session_status() !== PHP_SESSION_ACTIVE) session_start();

    if(isset($input["action"]) && $input["action"] == "clear"){

        $data = [];

        writeJson($file,$data);

        echo json_encode(["success"=>true]);

        exit;

    }

    if(isset($input["action"]) && $input["action"] == "like"){

        $id = $input["id"];

        foreach($data as &$item){

            if($item["id"] == $id){

                $item["likes"] = ($item["likes"] ?? 0) + 1;

                break;

            }

        }

        writeJson($file,$data);

        echo json_encode(["success"=>true]);

        exit;

    }

    $input["id"] = time();
    // attach user info if available
    $input["user_id"] = $_SESSION["user_id"] ?? null;
    $input["user_nom"] = $_SESSION["user_nom"] ?? null;

    $data[]=$input;

    writeJson($file,$data);

    echo json_encode(["success"=>true]);

}

if($_SERVER["REQUEST_METHOD"]=="DELETE"){

    checkAuth();

    $input=json_decode(file_get_contents("php://input"),true);

    $id = $input["id"];

    $data = array_filter($data, function($item) use ($id) {
        return $item["id"] != $id;
    });

    writeJson($file,$data);

    echo json_encode(["success"=>true]);

}

if($_SERVER["REQUEST_METHOD"]=="GET"){

    echo json_encode($data);

}

?>