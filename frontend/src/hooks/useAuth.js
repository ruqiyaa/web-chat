import { useEffect, useState } from "react";
import {api} from "../api";

export function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api("/api/me")
            .then((res) => {
                if(res.ok) setUser(res.data.user);
            })
            .catch(() =>{})
            .finally(() => setLoading(false));
    }, []);

    async function logout() {
        await api("/api/logout", { method: "POST"});
        setUser(null);
    }

    return {user, setUser, loading, logout};
}