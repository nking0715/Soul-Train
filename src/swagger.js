const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'});

const doc = {
    info: {
      title: 'My API',
      description: 'Description',
    },
    servers: [
        {
          url: "http://localhost:3000/",
          description: "local server"
        },
      ],
  };
  
  const outputFile = './doc/swagger-output.json';
  const endpointsFiles = ['./app.js'];
  
  /* NOTE: if you use the express Router, you must pass in the 
     'endpointsFiles' only the root file where the route starts,
     such as index.js, app.js, routes.js, ... */
  
  swaggerAutogen(outputFile, endpointsFiles, doc);