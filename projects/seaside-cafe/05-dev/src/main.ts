import { mount } from "./ui/app";
import "./style.css";

const root = document.querySelector("#app");
if (!root) throw new Error("找不到页面根节点");
mount(root);
