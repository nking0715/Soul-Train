const sendMail = require('./sendMail/gmail');



const main = async () => {
    const options = {
        from: 'edd.brown@soultrain.app',
        to: 'talentedblu@gmail.com',
        replyTo: 'edd.brown@soultrain.app',
        subject: 'Hello Edd 🚀',
        text: 'This email is sent from the command line',        
    };
    
    const messageId = await sendMail(options);
    return messageId;
}
main()
  .then((messageId) => console.log('Message sent successfully:', messageId))
  .catch((err) => console.error(err));