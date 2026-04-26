<?php
/**
*
*/
class Logger
{
	var $path;
	var $ident;
	var $errorPath;

	function __construct()
	{
		//Check if logger directorys exists
		$this->path = $_ENV['LOGGERPATH'];
		$this->errorPath = $_ENV['ERRORPATH'];
		
		if(!file_exists($this->path)){
			// Create the file if it does not exist
			$file = fopen($this->path, "w") or die("Unable to open file");
            fclose($file);
        }
		if(!file_exists($this->errorPath)){
			// Create the file if it does not exist
			$file = fopen($this->errorPath, "w") or die("Unable to open file");
            fclose($file);
		}
		$this->ident = generateRandomString();
	}

	function getIdent()
	{
		return $this->ident;
	}

	function setIdent($ident)
	{
		$this->ident = $ident;
	}

	function info($message){
		$file = fopen($this->path, "a") or die("Unable to open file");
		$d = gmdate('Y-m-d H:i:s');
		$msg = "$d ".$this->ident.": INFO.... $message\n";
		fwrite($file,$msg);
		fclose($file);
	}

	function error($message){
		$file = fopen($this->errorPath, "a") or die("Unable to open file");
		$d = gmdate('Y-m-d H:i:s');
		$msg = "$d ".$this->ident.": ERROR.... $message\n";
		fwrite($file,$msg);
		fclose($file);
	}

	function warn($message){
		$file = fopen($this->path, "a") or die("Unable to open file");
		$d = gmdate('Y-m-d H:i:s');
		$msg = "$d ".$this->ident.": WARN.... $message\n";
		fwrite($file,$msg);
		fclose($file);
	}

}

?>