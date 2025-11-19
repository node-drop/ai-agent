/**
 * URL Security Validator
 * 
 * Validates URLs for security concerns before making HTTP requests.
 * Prevents SSRF (Server-Side Request Forgery) attacks and other security issues.
 */

/**
 * Validate a URL for security concerns
 * @param {string} url - The URL to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateUrl(url) {
  const errors = [];

  try {
    // Parse the URL
    const parsedUrl = new URL(url);

    // Check protocol - only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      errors.push(`Protocol '${parsedUrl.protocol}' is not allowed. Only http and https are supported.`);
    }

    // Check for localhost and private IP ranges (basic SSRF prevention)
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      errors.push('Requests to localhost are not allowed for security reasons.');
    }

    // Block private IP ranges (basic check)
    if (hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.')) {
      errors.push('Requests to private IP addresses are not allowed for security reasons.');
    }

    // Block link-local addresses
    if (hostname.startsWith('169.254.')) {
      errors.push('Requests to link-local addresses are not allowed for security reasons.');
    }

  } catch (error) {
    errors.push(`Invalid URL format: ${error.message}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateUrl,
};
