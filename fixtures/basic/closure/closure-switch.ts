function handle_msg(e) {
    var ev = e.data;
    //          print("child_recv", JSON.stringify(ev));
    switch(ev.type) {
    case "abort":
        parent.postMessage({ type: "done" });
        parent.onmessage = null; /* terminate the worker */
        break;
    case "sab":
        /* modify the SharedArrayBuffer */
        ev.buf[2] = 10;
        parent.postMessage({ type: "sab_done", buf: ev.buf });
        break;
    }
}