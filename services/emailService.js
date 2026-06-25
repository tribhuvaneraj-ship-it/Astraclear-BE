import emailjs from '@emailjs/nodejs';

export const sendProcessedImageEmail = async ({ userName, userEmail, originalUrl, processedUrl, cloudCoverage }) => {
    const templateParams = {
        to_name: userName,
        to_email: userEmail,
        original_url: originalUrl,
        processed_url: processedUrl,
        cloud_coverage: `${cloudCoverage}%`,
    };

    try {
        const response = await emailjs.send(
            process.env.EMAILJS_SERVICE_ID,
            process.env.EMAILJS_TEMPLATE_ID,
            templateParams,
            {
                publicKey: process.env.EMAILJS_PUBLIC_KEY,
                privateKey: process.env.EMAILJS_PRIVATE_KEY,
            },
        );
        console.log(`Email sent to ${userEmail}: ${response.status} ${response.text}`);
    } catch (err) {
        console.error('EmailJS error:', err?.status, err?.text || err?.message || err);
    }
};
