import { Service } from "../service.js";

const service = new Service();

service.init().then(() => {
    service.run();
});