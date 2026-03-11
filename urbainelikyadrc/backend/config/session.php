<?php
session_start();

function checkAuth(){
    if(!isset($_SESSION['user_id'])){
        http_response_code(403);
        echo json_encode(["error"=>"Connexion requise"]);
        exit;
    }
}
?>