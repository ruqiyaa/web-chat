// 


const line = { name: "Ben", text: "hi"};
const stamped = {...line, ts: Date.now()};
const renamed = {...line, stamp: Date.now()};

console.log(stamped);
console.log(renamed);
console.log(stamped.ts, renamed.ts);