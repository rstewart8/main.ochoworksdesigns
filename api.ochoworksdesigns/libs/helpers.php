<?php
require_once 'logger.php';

// Initialize logger if not already set  
if (!isset($logger)) {
    $logger = new Logger();
    $logger->info("Logger initialized in helpers.php");
}

/**
 * Generate a random string of specified length
 */
function generateRandomString($length = 10)
{
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomString;
}

/**
 * Generate a random integer within a specified range
 */
function generateRandomPlanId()
{
    $min = 5000; // Minimum plan ID
    $max = 999999; // Maximum plan ID

    /// Stringfy the random number to ensure it is always 6 digits
    $randomId = rand($min, $max);
    return str_pad($randomId, 6, '0', STR_PAD_LEFT);
}

/**
 * Convert decimal to ft, inches, and fractions.  $precision to round to nearest fraction e.g.0 = ft inch only, 2 = 1/2 inch, 4 = 1/4 inch, 8 = 1/8 inch, 16 = 1/16 inch
 */
function convertDecimalToFeetInches($decimal, $precision = 0)
{
    global $logger;

    $logger->info("Converting decimal to feet and inches: $decimal with precision $precision");

    if ($decimal === null || $decimal === '') {
        return null;
    }

    // Get feet (whole number part)
    $feet = floor($decimal);

    // Get remaining decimal and convert to inches
    $totalInches = ($decimal - $feet) * 12;

    $logger->info("Feet: $feet, Total inches: $totalInches");

    if ($precision > 0) {
        // Round to nearest fraction
        $roundedInches = round($totalInches * $precision) / $precision;

        // Get whole inches
        $wholeInches = floor($roundedInches);

        // Get fractional part
        $fractionDecimal = $roundedInches - $wholeInches;

        // Convert fraction decimal to numerator
        $numerator = round($fractionDecimal * $precision);

        $logger->info("Rounded inches: $roundedInches, Whole inches: $wholeInches, Fraction: $numerator/$precision");

        // Simplify fraction if possible
        if ($numerator > 0) {
            $gcd = gcd($numerator, $precision);
            $numerator = $numerator / $gcd;
            $denominator = $precision / $gcd;
        } else {
            $denominator = $precision;
        }

        // Handle case where fraction equals 1 (add to whole inches)
        if ($numerator >= $denominator) {
            $wholeInches += floor($numerator / $denominator);
            $numerator = $numerator % $denominator;
        }

        // Handle case where inches >= 12 (add to feet)
        if ($wholeInches >= 12) {
            $feet += floor($wholeInches / 12);
            $wholeInches = $wholeInches % 12;
        }

        // Format the result
        if ($numerator > 0) {
            if ($wholeInches > 0) {
                $formatted = sprintf("%d' %d %d/%d", $feet, $wholeInches, $numerator, $denominator);
            } else {
                $formatted = sprintf("%d' %d/%d", $feet, $numerator, $denominator);
            }
        } else {
            if ($wholeInches > 0) {
                $formatted = sprintf("%d' %d", $feet, $wholeInches);
            } else {
                $formatted = sprintf("%d'", $feet);
            }
        }
    } else {
        // No fractions, just round to nearest whole inch
        $wholeInches = round($totalInches);

        // Handle case where inches >= 12 (add to feet)
        if ($wholeInches >= 12) {
            $feet += floor($wholeInches / 12);
            $wholeInches = $wholeInches % 12;
        }

        if ($wholeInches > 0) {
            $formatted = sprintf("%d' %d", $feet, $wholeInches);
        } else {
            $formatted = sprintf("%d'", $feet);
        }
    }

    $logger->info("Final result: $formatted");

    return $formatted;
}

/**
 * Calculate Greatest Common Divisor (GCD) for fraction simplification
 */
function gcd($a, $b)
{
    if ($b == 0) {
        return $a;
    }
    return gcd($b, $a % $b);
}

/**
 * Convert feet and inches to decimal eg: 75' 3 1/4" to 75.27 precision 4 decimal
 */
function convertFeetInchesToDecimal($string)
{
    global $logger;

    $logger->info("Converting feet and inches to decimal: $string");

    $feet = 0;
    $inches = 0;
    $numerator = 0;
    $denominator = 1;

    // Pattern 1: Just feet (e.g., "50'")
    if (preg_match("/^(\d+)'$/", $string, $matches)) {
        $feet = (int)$matches[1];
    }
    // Pattern 2: Feet and whole inches (e.g., "50' 6"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\"$/", $string, $matches)) {
        $feet = (int)$matches[1];
        $inches = (int)$matches[2];
    }
    // Pattern 3: Feet, inches, and fraction (e.g., "50' 6 1/2"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\s+(\d+)\/(\d+)\"$/", $string, $matches)) {
        $feet = (int)$matches[1];
        $inches = (int)$matches[2];
        $numerator = (int)$matches[3];
        $denominator = (int)$matches[4];
    }
    // Pattern 4: Just feet and fraction (e.g., "50' 1/2"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\/(\d+)\"$/", $string, $matches)) {
        $feet = (int)$matches[1];
        $inches = 0;
        $numerator = (int)$matches[2];
        $denominator = (int)$matches[3];
    } else {
        throw new InvalidArgumentException("Invalid feet and inches format. Expected formats: '50\'' or '50\' 6\"' or '50\' 6 1/2\"'");
    }

    $logger->info("Converting feet and inches to decimal: $feet' $inches $numerator/$denominator\"");

    // Validate fraction
    if ($denominator === 0) {
        throw new InvalidArgumentException("Fraction denominator cannot be zero");
    }

    // Convert to decimal
    $decimal = $feet + ($inches / 12) + ($numerator / ($denominator * 12));
    return round($decimal, 4);
}

/**
 * Validate value with specific increment (e.g., 0.5, 0.25, 1.0)
 */
function validateIncrement($value, $increment, $fieldName, $allowZero = true)
{
    global $logger;
    $value = (float)$value;
    $logger->info("Validating $fieldName: $value with increment $increment, allowZero: " . ($allowZero ? 'true' : 'false'));
    $minValue = $allowZero ? 0 : $increment;
    if ($value < $minValue) {
        $minText = $allowZero ? "0 or positive" : "greater than 0";
        throw new InvalidArgumentException("$fieldName must be $minText");
    }

    // Check if it's a valid increment
    $remainder = fmod($value, $increment);
    if (abs($remainder) > 0.001) { // Small tolerance for floating point precision
        throw new InvalidArgumentException("$fieldName must be in $increment increments");
    }

    $logger->info("Final validated value for $fieldName: $value");

    return $value;
}

/**
 * Validate and format as integer
 */
function validateInteger($value, $fieldName, $allowZero = false)
{
    $value = (int)$value;

    $minValue = $allowZero ? 0 : 1;
    if ($value < $minValue) {
        $minText = $allowZero ? "0 or positive" : "greater than 0";
        throw new InvalidArgumentException("$fieldName must be a positive integer $minText");
    }

    return $value;
}

/**
 * Validate and format decimal with specified precision
 */
function validateDecimal($value, $precision, $fieldName, $allowZero = false)
{
    $value = (float)$value;

    $minValue = $allowZero ? 0 : 0.0001; // Very small positive number
    if ($value < $minValue) {
        $minText = $allowZero ? "0 or positive" : "greater than 0";
        throw new InvalidArgumentException("$fieldName must be a positive number $minText");
    }

    return round($value, $precision);
}

/**
 * Validate and format currency (2 decimal places)
 */
function validateCurrency($value, $fieldName, $allowZero = true)
{
    return validateDecimal($value, 2, $fieldName, $allowZero);
}

/**
 * Format currency as display string
 */
function formatCurrencyDisplay($value)
{
    return '$' . number_format($value, 2);
}

/**
 * Validate required field is not empty
 */
function validateRequired($value, $fieldName)
{
    if (!isset($value) || $value === '' || $value === null) {
        throw new InvalidArgumentException("$fieldName is required");
    }
    return $value;
}

/**
 * Validate and sanitize text field
 */
function validateText($value, $fieldName, $required = true, $maxLength = null)
{
    if ($required) {
        validateRequired($value, $fieldName);
    }

    if ($value === null || $value === '') {
        return $required ? null : null;
    }

    $value = trim($value);

    if ($maxLength && strlen($value) > $maxLength) {
        throw new InvalidArgumentException("$fieldName cannot exceed $maxLength characters");
    }

    return $value;
}

/**
 * Validate JSON string
 */
function validateJson($value, $fieldName, $required = false)
{
    if (!$required && ($value === null || $value === '')) {
        return null;
    }

    if ($required) {
        validateRequired($value, $fieldName);
    }

    $decoded = json_decode($value);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new InvalidArgumentException("$fieldName must be valid JSON format");
    }

    return $value;
}

/**
 * Validate all plan data according to specifications
 */
function validatePlanData($data)
{
    $validatedData = [];

    try {
        // Text fields
        $validatedData['title'] = validateText($data['title'] ?? null, 'title', true, 255);
        $validatedData['description'] = validateText($data['description'] ?? null, 'description', false, 1000);

        // JSON field
        $validatedData['specs'] = validateJson($data['specs'] ?? null, 'Specs', false);

        // 0.5 increment fields
        $validatedData['bedrooms'] = validateIncrement($data['bedrooms'] ?? null, 0.5, 'bedrooms', false);
        $validatedData['bathrooms'] = validateIncrement($data['bathrooms'] ?? null, 0.25, 'bathrooms', false);
        $validatedData['stories'] = validateIncrement($data['stories'] ?? null, 0.5, 'stories', false);
        $validatedData['garage'] = validateIncrement($data['garage'] ?? null, 0.5, 'garage', true);

        // Integer field
        $validatedData['square_footage'] = validateInteger($data['square_footage'] ?? null, 'square_footage', false);

        // Decimal fields with 4 precision
        $validatedData['width'] = validateDecimal($data['width'] ?? null, 4, 'width', false);
        $validatedData['depth'] = validateDecimal($data['depth'] ?? null, 4, 'depth', false);

        // Currency field
        $validatedData['price'] = validateCurrency($data['price'] ?? null, 'Price', true);
    } catch (InvalidArgumentException $e) {
        throw $e;
    } catch (Exception $e) {
        throw new InvalidArgumentException('Validation error: ' . $e->getMessage());
    }

    return $validatedData;
}

/**
 * Generic validation configuration for different field types
 */
function validateField($value, $config, $fieldName)
{
    global $logger;
    $logger->info("value: $value, Validating $fieldName with config: " . print_r($config, true));
    switch ($config['type']) {
        case 'increment':
            return validateIncrement($value, $config['increment'], $fieldName, $config['allowZero'] ?? true);

        case 'integer':
            return validateInteger($value, $fieldName, $config['allowZero'] ?? false);

        case 'decimal':
            return validateDecimal($value, $config['precision'], $fieldName, $config['allowZero'] ?? false);

        case 'currency':
            return validateCurrency($value, $fieldName, $config['allowZero'] ?? true);

        case 'text':
            return validateText($value, $fieldName, $config['required'] ?? true, $config['maxLength'] ?? null);

        case 'json':
            return validateJson($value, $fieldName, $config['required'] ?? false);

        case 'enum':
            return validateEnum($value, $config['values'], $fieldName, $config['required'] ?? false);

        case 'feet_inches':
            return validateFeetInches($value, $fieldName, $config['allowZero'] ?? false);

        default:
            throw new InvalidArgumentException("Unknown validation type: {$config['type']}");
    }
}

/**
 * Validate feet and inches format and convert to decimal
 * Supports formats: 50', 50' 6", 50' 6 1/2"
 */
function validateFeetInches($value, $fieldName, $allowZero = false)
{
    global $logger;

    if ($value === null || $value === '') {
        if (!$allowZero) {
            throw new InvalidArgumentException("$fieldName is required");
        }
        return null;
    }

    $value = trim($value);

    $feet = 0;
    $inches = 0;
    $numerator = 0;
    $denominator = 1;

    // Pattern 1: Just feet (e.g., "50'")
    if (preg_match("/^(\d+)'$/", $value, $matches)) {
        $feet = (int)$matches[1];
        $logger->info("Validating feet only: $feet'");
    }
    // Pattern 2: Feet and whole inches (e.g., "50' 6"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\"$/", $value, $matches)) {
        $feet = (int)$matches[1];
        $inches = (int)$matches[2];
        $logger->info("Validating feet and inches: $feet' $inches\"");
    }
    // Pattern 3: Feet, inches, and fraction (e.g., "50' 6 1/2"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\s+(\d+)\/(\d+)\"$/", $value, $matches)) {
        $feet = (int)$matches[1];
        $inches = (int)$matches[2];
        $numerator = (int)$matches[3];
        $denominator = (int)$matches[4];
        $logger->info("Validating feet, inches and fraction: $feet' $inches $numerator/$denominator\"");
    }
    // Pattern 4: Just feet and fraction (e.g., "50' 1/2"")
    elseif (preg_match("/^(\d+)'\s+(\d+)\/(\d+)\"$/", $value, $matches)) {
        $feet = (int)$matches[1];
        $inches = 0;
        $numerator = (int)$matches[2];
        $denominator = (int)$matches[3];
        $logger->info("Validating feet and fraction: $feet' $numerator/$denominator\"");
    } else {
        throw new InvalidArgumentException("$fieldName must be in one of these formats: '50\'' or '50\' 6\"' or '50\' 6 1/2\"'");
    }

    // Validate fraction if present
    if ($denominator === 0) {
        throw new InvalidArgumentException("$fieldName: fraction denominator cannot be zero");
    }

    if ($numerator >= $denominator) {
        throw new InvalidArgumentException("$fieldName: fraction must be less than 1 (numerator must be less than denominator)");
    }

    // Validate inches
    if ($inches >= 12) {
        throw new InvalidArgumentException("$fieldName: inches must be less than 12");
    }

    // Convert to decimal
    $decimal = $feet + ($inches / 12) + ($numerator / ($denominator * 12));

    // Check if zero and allowZero setting
    if (!$allowZero && $decimal <= 0) {
        throw new InvalidArgumentException("$fieldName must be greater than 0");
    }

    // Round to 4 decimal places for precision
    $result = round($decimal, 4);

    $logger->info("Converted $value to decimal: $result");

    return $result;
}


/**
 * Validate data using configuration array
 */
function validateDataWithConfig($data, $validationConfig)
{
    $validatedData = [];

    foreach ($validationConfig as $fieldName => $config) {
        try {
            $value = $data[$fieldName] ?? null;
            $validatedData[$fieldName] = validateField($value, $config, ucfirst($fieldName));
        } catch (InvalidArgumentException $e) {
            throw $e;
        }
    }

    return $validatedData;
}

/**
 * Validate enum value against allowed values
 */
function validateEnum($value, $allowedValues, $fieldName, $required = false)
{
    if (!$required && ($value === null || $value === '')) {
        return null;
    }

    if ($required) {
        validateRequired($value, $fieldName);
    }

    $value = trim($value);

    if (!in_array($value, $allowedValues, true)) {
        $allowedValuesStr = implode(', ', $allowedValues);
        throw new InvalidArgumentException("$fieldName must be one of: $allowedValuesStr");
    }

    return $value;
}

/**
 * Stringify int, eg: 2.0 becomes "2", 2.5 becomes "2.5"
 */

function stringifyInt($value)
{
    if (is_null($value)) {
        return null;
    }

    $value = (float)$value;

    // Check if it's an integer
    if (floor($value) == $value) {
        return (string)(int)$value; // Convert to int and then to string
    } else {
        return (string)$value; // Keep as float string
    }
}   