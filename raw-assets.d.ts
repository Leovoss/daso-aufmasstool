declare module '*?raw' {const content:string;export default content;}

declare module '*.png?inline' {
  const src: string;
  export default src;
}
